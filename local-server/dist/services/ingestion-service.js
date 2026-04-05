"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestionService = void 0;
const papaparse_1 = __importDefault(require("papaparse"));
const uuid_1 = require("uuid");
const dossiers_service_1 = require("./dossiers-service");
const findings_service_1 = require("./findings-service");
const flights_service_1 = require("./flights-service");
const rules_service_1 = require("./rules-service");
const db_1 = require("../database/db");
const audit_service_1 = require("./audit-service");
const REQUIRED_COLUMNS = ['flight_id', 'tail_number', 'timestamp', 'phase'];
const METADATA_COLUMNS = new Set([
    ...REQUIRED_COLUMNS,
    'base',
    'technician',
    'pilot',
    'pilot_name',
    'weather',
    'system',
    'warning_code',
    'sensor_ok',
    'maintenance_needed',
    'param_tag',
    'note',
    'mission_type',
]);
exports.ingestionService = {
    ingestCsv(params) {
        const parsed = papaparse_1.default.parse(params.csvContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
        });
        if (parsed.errors.length > 0) {
            throw new Error(`CSV parse failed: ${parsed.errors[0].message}`);
        }
        const rows = parsed.data.filter((row) => REQUIRED_COLUMNS.every((column) => row[column] != null && String(row[column]).trim() !== ''));
        if (rows.length === 0) {
            throw new Error('No valid CSV rows found');
        }
        const availableParameters = this.deriveNumericParameters(rows);
        const groupedFlights = this.groupRowsByFlight(rows, availableParameters);
        const persistedFlights = Array.from(groupedFlights.values());
        const batchId = (0, uuid_1.v4)();
        flights_service_1.flightsService.replaceBatch({
            batchId,
            sourceType: 'csv',
            sourceName: 'manual-upload',
            sourceFilename: params.sourceFilename,
            importedBy: params.actorId,
            flights: persistedFlights,
        });
        let findingCount = 0;
        for (const flight of persistedFlights) {
            const dossier = dossiers_service_1.dossiersService.upsert({
                flightId: flight.flightId,
                tailNumber: flight.tailNumber,
                flightDate: flight.startTime.split('T')[0],
            });
            findingCount += this.replaceFindingsForFlight({
                flight,
                dossierId: dossier.id,
                actorId: params.actorId,
                actorRole: params.actorRole,
            });
            dossiers_service_1.dossiersService.syncStatus(dossier.id);
        }
        audit_service_1.auditService.write({
            actorId: params.actorId,
            actorRole: params.actorRole,
            action: 'ingestion.csv_imported',
            entityType: 'system',
            entityId: batchId,
            newValue: {
                sourceFilename: params.sourceFilename,
                recordCount: rows.length,
                flightCount: persistedFlights.length,
                findingCount,
            },
        });
        return {
            batchId,
            recordCount: rows.length,
            flightCount: persistedFlights.length,
            findingCount,
            availableParameters,
        };
    },
    deriveNumericParameters(rows) {
        const numericColumns = new Map();
        for (const row of rows) {
            for (const [key, rawValue] of Object.entries(row)) {
                if (METADATA_COLUMNS.has(key)) {
                    continue;
                }
                const trimmed = rawValue?.trim();
                if (!trimmed) {
                    continue;
                }
                const numericValue = Number(trimmed);
                if (!Number.isFinite(numericValue)) {
                    continue;
                }
                numericColumns.set(key, (numericColumns.get(key) || 0) + 1);
            }
        }
        return Array.from(numericColumns.entries())
            .filter(([, count]) => count > 0)
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .map(([key]) => key);
    },
    groupRowsByFlight(rows, availableParameters) {
        const grouped = new Map();
        for (const row of rows) {
            const flightId = row.flight_id.trim();
            const timestamp = new Date(row.timestamp).toISOString();
            const record = {
                timestamp,
                phase: row.phase.trim(),
                parameters: availableParameters.reduce((acc, parameter) => {
                    const raw = row[parameter];
                    const value = raw == null || raw === '' ? Number.NaN : Number(raw);
                    if (!Number.isNaN(value)) {
                        acc[parameter] = value;
                    }
                    return acc;
                }, {}),
            };
            const existing = grouped.get(flightId);
            if (!existing) {
                grouped.set(flightId, {
                    flightId,
                    tailNumber: row.tail_number.trim(),
                    missionType: row.mission_type?.trim() || null,
                    startTime: timestamp,
                    endTime: timestamp,
                    durationMinutes: 0,
                    phases: [record.phase],
                    availableParameters,
                    records: [record],
                });
                continue;
            }
            existing.records.push(record);
            existing.startTime = existing.startTime < timestamp ? existing.startTime : timestamp;
            existing.endTime = existing.endTime > timestamp ? existing.endTime : timestamp;
            if (!existing.phases.includes(record.phase)) {
                existing.phases.push(record.phase);
            }
        }
        for (const flight of grouped.values()) {
            flight.records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
            const start = new Date(flight.startTime).getTime();
            const end = new Date(flight.endTime).getTime();
            flight.durationMinutes = Math.max(0, Math.round(((end - start) / 60000) * 100) / 100);
        }
        return grouped;
    },
    replaceFindingsForFlight(params) {
        const db = (0, db_1.getDb)();
        const existing = findings_service_1.findingsService.list({ flightId: params.flight.flightId });
        const generated = existing.filter((finding) => finding.generatedBy === 'csv-ingestion');
        for (const finding of generated) {
            db.prepare('DELETE FROM findings WHERE id = ?').run(finding.id);
        }
        const rules = rules_service_1.rulesService.listActive();
        let count = 0;
        for (const rule of rules) {
            const parameterSamples = params.flight.records
                .map((record) => record.parameters[rule.parameter])
                .filter((value) => typeof value === 'number' && Number.isFinite(value));
            if (parameterSamples.length === 0) {
                continue;
            }
            const evaluation = evaluateRule(rule.thresholdType, rule.thresholdValue, parameterSamples);
            if (!evaluation.triggered) {
                continue;
            }
            findings_service_1.findingsService.create({
                title: rule.name || rule.ruleId,
                titleHe: rule.name || rule.ruleId,
                summary: rule.description || `${rule.parameter} triggered`,
                summaryHe: rule.description || `${rule.parameter} triggered`,
                severity: rule.severityS,
                classification: rule.system || rule.ruleId,
                sourceType: 'measured',
                aircraftId: params.flight.tailNumber,
                flightId: params.flight.flightId,
                dossierId: params.dossierId,
                ruleId: rule.ruleId,
                evidenceRefs: [`${rule.parameter}:${evaluation.actualValue}`],
                generatedBy: 'csv-ingestion',
            }, params.actorId, params.actorRole);
            rules_service_1.rulesService.updateMetrics(rule.ruleId, {
                lastRun: new Date().toISOString(),
                matchedCount: rule.metrics.matchedCount + 1,
                impactedAircraft: [params.flight.tailNumber],
                lastMatchedFlightId: params.flight.flightId,
            });
            count += 1;
        }
        return count;
    },
};
function evaluateRule(thresholdType, thresholdValue, samples) {
    switch (thresholdType) {
        case 'greater_than': {
            const actualValue = Math.max(...samples);
            return { triggered: actualValue > Number(thresholdValue), actualValue };
        }
        case 'less_than': {
            const actualValue = Math.min(...samples);
            return { triggered: actualValue < Number(thresholdValue), actualValue };
        }
        case 'band': {
            if (!Array.isArray(thresholdValue))
                return { triggered: false };
            const actualValue = samples.find((sample) => sample < thresholdValue[0] || sample > thresholdValue[1]);
            return { triggered: actualValue != null, actualValue };
        }
        default:
            return { triggered: false };
    }
}
//# sourceMappingURL=ingestion-service.js.map