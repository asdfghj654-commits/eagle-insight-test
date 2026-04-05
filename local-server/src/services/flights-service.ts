import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';

export interface TelemetryRecordInput {
  timestamp: string;
  phase: string;
  parameters: Record<string, number>;
}

export interface PersistedFlightInput {
  flightId: string;
  tailNumber: string;
  missionType?: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  phases: string[];
  availableParameters: string[];
  records: TelemetryRecordInput[];
}

export interface PersistedFlight {
  flightId: string;
  tailNumber: string;
  missionType: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  phases: string[];
  availableParameters: string[];
  recordCount: number;
  records: TelemetryRecordInput[];
  createdAt: string;
  updatedAt: string;
}

function sampleRecords(records: TelemetryRecordInput[], sampleSize?: number | null): TelemetryRecordInput[] {
  if (!sampleSize || sampleSize <= 0 || records.length <= sampleSize) {
    return records;
  }

  if (sampleSize === 1) {
    return [records[0]];
  }

  const sampled: TelemetryRecordInput[] = [];
  const lastIndex = records.length - 1;

  for (let index = 0; index < sampleSize; index += 1) {
    const sourceIndex = Math.round((index / (sampleSize - 1)) * lastIndex);
    sampled.push(records[sourceIndex]);
  }

  return sampled;
}

export const flightsService = {
  replaceBatch(params: {
    batchId: string;
    sourceType: string;
    sourceName?: string;
    sourceFilename?: string;
    importedBy?: string;
    flights: PersistedFlightInput[];
  }): void {
    const db = getDb();
    const now = new Date().toISOString();
    const totalRecords = params.flights.reduce((sum, flight) => sum + flight.records.length, 0);

    db.prepare(`
      INSERT INTO ingestion_batches
        (id, source_type, source_name, source_filename, record_count, flight_count, imported_by, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.batchId,
      params.sourceType,
      params.sourceName ?? null,
      params.sourceFilename ?? null,
      totalRecords,
      params.flights.length,
      params.importedBy ?? null,
      now,
    );

    for (const flight of params.flights) {
      this.deleteFlightArtifacts(flight.flightId);

      db.prepare(`
        INSERT INTO flights
          (id, batch_id, flight_id, tail_number, mission_type, start_time, end_time,
           duration_minutes, phases, available_parameters, record_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        params.batchId,
        flight.flightId,
        flight.tailNumber,
        flight.missionType ?? null,
        flight.startTime,
        flight.endTime,
        flight.durationMinutes,
        JSON.stringify(flight.phases),
        JSON.stringify(flight.availableParameters),
        flight.records.length,
        now,
        now,
      );

      const insertRecord = db.prepare(`
        INSERT INTO telemetry_records
          (id, flight_id, timestamp, phase, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const record of flight.records) {
        insertRecord.run(
          uuidv4(),
          flight.flightId,
          record.timestamp,
          record.phase,
          JSON.stringify(record.parameters),
          now,
        );
      }
    }
  },

  list(options?: { sampleSize?: number | null }): PersistedFlight[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM flights
      ORDER BY start_time DESC, flight_id DESC
    `).all() as Array<Record<string, unknown>>;

    return rows
      .map((row) => this.getByFlightId(String(row.flight_id), options))
      .filter(Boolean) as PersistedFlight[];
  },

  getByFlightId(flightId: string, options?: { sampleSize?: number | null }): PersistedFlight | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM flights WHERE flight_id = ?').get(flightId) as Record<string, unknown> | undefined;
    if (!row) return null;

    const recordRows = db.prepare(`
      SELECT timestamp, phase, payload
      FROM telemetry_records
      WHERE flight_id = ?
      ORDER BY timestamp ASC
    `).all(flightId) as Array<Record<string, string>>;

    const records = recordRows.map((record) => ({
      timestamp: record.timestamp,
      phase: record.phase,
      parameters: JSON.parse(record.payload ?? '{}'),
    }));

    return {
      flightId: String(row.flight_id),
      tailNumber: String(row.tail_number),
      missionType: row.mission_type ? String(row.mission_type) : null,
      startTime: String(row.start_time),
      endTime: String(row.end_time),
      durationMinutes: Number(row.duration_minutes ?? 0),
      phases: JSON.parse(String(row.phases ?? '[]')),
      availableParameters: JSON.parse(String(row.available_parameters ?? '[]')),
      recordCount: Number(row.record_count ?? 0),
      records: sampleRecords(records, options?.sampleSize),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  },

  deleteFlightArtifacts(flightId: string): void {
    const db = getDb();
    db.prepare('DELETE FROM telemetry_records WHERE flight_id = ?').run(flightId);
    db.prepare('DELETE FROM flights WHERE flight_id = ?').run(flightId);
  },
};
