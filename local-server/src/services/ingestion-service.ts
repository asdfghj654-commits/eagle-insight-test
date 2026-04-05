import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { dossiersService } from './dossiers-service';
import { findingsService } from './findings-service';
import { flightsService, PersistedFlightInput, TelemetryRecordInput } from './flights-service';
import { rulesService } from './rules-service';
import { getDb } from '../database/db';
import { auditService } from './audit-service';

type CsvRow = Record<string, string>;

export interface IngestionResult {
  batchId: string;
  recordCount: number;
  flightCount: number;
  findingCount: number;
  availableParameters: string[];
}

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

export const ingestionService = {
  ingestCsv(params: {
    csvContent: string;
    sourceFilename?: string;
    actorId: string;
    actorRole: string;
  }): IngestionResult {
    const parsed = Papa.parse<CsvRow>(params.csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors.length > 0) {
      throw new Error(`CSV parse failed: ${parsed.errors[0].message}`);
    }

    const rows = parsed.data.filter((row) =>
      REQUIRED_COLUMNS.every((column) => row[column] != null && String(row[column]).trim() !== ''),
    );

    if (rows.length === 0) {
      throw new Error('No valid CSV rows found');
    }

    const availableParameters = this.deriveNumericParameters(rows);
    const groupedFlights = this.groupRowsByFlight(rows, availableParameters);
    const persistedFlights = Array.from(groupedFlights.values());
    const batchId = uuidv4();

    flightsService.replaceBatch({
      batchId,
      sourceType: 'csv',
      sourceName: 'manual-upload',
      sourceFilename: params.sourceFilename,
      importedBy: params.actorId,
      flights: persistedFlights,
    });

    let findingCount = 0;
    for (const flight of persistedFlights) {
      const dossier = dossiersService.upsert({
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

      dossiersService.syncStatus(dossier.id);
    }

    auditService.write({
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

  deriveNumericParameters(rows: CsvRow[]): string[] {
    const numericColumns = new Map<string, number>();

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

  groupRowsByFlight(rows: CsvRow[], availableParameters: string[]): Map<string, PersistedFlightInput> {
    const grouped = new Map<string, PersistedFlightInput>();

    for (const row of rows) {
      const flightId = row.flight_id.trim();
      const timestamp = new Date(row.timestamp).toISOString();
      const record: TelemetryRecordInput = {
        timestamp,
        phase: row.phase.trim(),
        parameters: availableParameters.reduce<Record<string, number>>((acc, parameter) => {
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

  replaceFindingsForFlight(params: {
    flight: PersistedFlightInput;
    dossierId: string;
    actorId: string;
    actorRole: string;
  }): number {
    const db = getDb();
    const existing = findingsService.list({ flightId: params.flight.flightId });
    const generated = existing.filter((finding) => finding.generatedBy === 'csv-ingestion');
    for (const finding of generated) {
      db.prepare('DELETE FROM findings WHERE id = ?').run(finding.id);
    }

    const rules = rulesService.listActive();
    let count = 0;

    for (const rule of rules) {
      const parameterSamples = params.flight.records
        .map((record) => record.parameters[rule.parameter])
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

      if (parameterSamples.length === 0) {
        continue;
      }

      const evaluation = evaluateRule(rule.thresholdType, rule.thresholdValue, parameterSamples);
      if (!evaluation.triggered) {
        continue;
      }

      findingsService.create({
        title: rule.name || rule.ruleId,
        titleHe: rule.name || rule.ruleId,
        summary: rule.description || `${rule.parameter} triggered`,
        summaryHe: rule.description || `${rule.parameter} triggered`,
        severity: rule.severityS as 'S1' | 'S2' | 'S3' | 'S4',
        classification: rule.system || rule.ruleId,
        sourceType: 'measured',
        aircraftId: params.flight.tailNumber,
        flightId: params.flight.flightId,
        dossierId: params.dossierId,
        ruleId: rule.ruleId,
        evidenceRefs: [`${rule.parameter}:${evaluation.actualValue}`],
        generatedBy: 'csv-ingestion',
      }, params.actorId, params.actorRole);

      rulesService.updateMetrics(rule.ruleId, {
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

function evaluateRule(
  thresholdType: string,
  thresholdValue: number | [number, number],
  samples: number[],
): { triggered: boolean; actualValue?: number } {
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
      if (!Array.isArray(thresholdValue)) return { triggered: false };
      const actualValue = samples.find((sample) => sample < thresholdValue[0] || sample > thresholdValue[1]);
      return { triggered: actualValue != null, actualValue };
    }
    default:
      return { triggered: false };
  }
}
