/**
 * Realistic F-16 demo flight data generator.
 * Produces multiple sorties across 5 aircraft with telemetry covering
 * all expected rule-engine parameters. Includes deliberate anomalies
 * so the investigation workbench has something meaningful to explore.
 */

import type { ProcessedFlight, CSVRecord } from '@/contexts/CSVDataContext';

// ── Aircraft / crew catalogue ──────────────────────────────────────
const AIRCRAFT: { tail: string; pilot: string }[] = [
  { tail: '405', pilot: 'סא"ל אביתר כהן' },
  { tail: '418', pilot: 'רס"ן יואב לוי' },
  { tail: '423', pilot: 'סא"ל ענת שפירא' },
  { tail: '431', pilot: 'רס"ן אמיר בן-דוד' },
  { tail: '447', pilot: 'סרן נועה כץ' },
];

const MISSION_TYPES = ['אימון קרב', 'יירוט', 'סיור', 'תרגיל ציר', 'ניווט לילה'];

// ── Phase timeline — records at 15-second intervals ────────────────
type Phase = CSVRecord['phase'];
const PHASE_TIMELINE: { phase: Phase; count: number }[] = [
  { phase: 'taxi',    count: 12 },
  { phase: 'takeoff', count: 6  },
  { phase: 'climb',   count: 24 },
  { phase: 'cruise',  count: 46 },
  { phase: 'descent', count: 18 },
  { phase: 'landing', count: 9  },
];
const TOTAL_RECORDS = PHASE_TIMELINE.reduce((s, p) => s + p.count, 0); // 115

// ── Numeric parameters generated per record ────────────────────────
type Params = {
  altitude: number;
  airspeed: number;
  n1_pct: number;
  egt_celsius: number;
  oil_pressure: number;
  hydraulic_pressure_psi: number;
  fuel_flow_pph: number;
  fuel_remaining_lbs: number;
  g_force: number;
  brake_temp_celsius: number;
  voltage_v: number;
};

export const DEMO_PARAMETERS: (keyof Params)[] = [
  'altitude', 'airspeed', 'brake_temp_celsius', 'egt_celsius',
  'fuel_flow_pph', 'fuel_remaining_lbs', 'g_force',
  'hydraulic_pressure_psi', 'n1_pct', 'oil_pressure', 'voltage_v',
];

// ── Phase baselines ────────────────────────────────────────────────
const PHASE_BASELINES: Record<Phase, Params> = {
  taxi:    { altitude: 190,   airspeed: 12,  n1_pct: 62, egt_celsius: 415, oil_pressure: 63, hydraulic_pressure_psi: 2950, fuel_flow_pph: 1750,  fuel_remaining_lbs: 7200, g_force: 1.00, brake_temp_celsius: 80,  voltage_v: 28.2 },
  takeoff: { altitude: 350,   airspeed: 185, n1_pct: 98, egt_celsius: 580, oil_pressure: 82, hydraulic_pressure_psi: 3010, fuel_flow_pph: 12200, fuel_remaining_lbs: 7020, g_force: 1.65, brake_temp_celsius: 215, voltage_v: 27.8 },
  climb:   { altitude: 16000, airspeed: 375, n1_pct: 92, egt_celsius: 524, oil_pressure: 76, hydraulic_pressure_psi: 2890, fuel_flow_pph: 7900,  fuel_remaining_lbs: 6100, g_force: 1.30, brake_temp_celsius: 55,  voltage_v: 28.1 },
  cruise:  { altitude: 28000, airspeed: 448, n1_pct: 85, egt_celsius: 478, oil_pressure: 71, hydraulic_pressure_psi: 2820, fuel_flow_pph: 5400,  fuel_remaining_lbs: 4600, g_force: 1.00, brake_temp_celsius: 38,  voltage_v: 28.1 },
  descent: { altitude: 7000,  airspeed: 295, n1_pct: 70, egt_celsius: 438, oil_pressure: 68, hydraulic_pressure_psi: 2860, fuel_flow_pph: 3400,  fuel_remaining_lbs: 2900, g_force: 1.10, brake_temp_celsius: 48,  voltage_v: 28.0 },
  landing: { altitude: 200,   airspeed: 28,  n1_pct: 64, egt_celsius: 427, oil_pressure: 64, hydraulic_pressure_psi: 2930, fuel_flow_pph: 1550,  fuel_remaining_lbs: 2250, g_force: 1.05, brake_temp_celsius: 310, voltage_v: 27.9 },
};

// ── Noise amplitudes (±value around baseline) ──────────────────────
const PARAM_NOISE: Record<keyof Params, number> = {
  altitude: 140, airspeed: 7, n1_pct: 1.4, egt_celsius: 11, oil_pressure: 3,
  hydraulic_pressure_psi: 55, fuel_flow_pph: 180, fuel_remaining_lbs: 18,
  g_force: 0.14, brake_temp_celsius: 14, voltage_v: 0.14,
};

// ── Anomaly scenarios ──────────────────────────────────────────────
// Each produces a smooth sin-shaped spike that may cross thresholds.
const ANOMALIES: { tail: string; phase: Phase; param: keyof Params; peak: number; startAt: number }[] = [
  // Tail 418 — hydraulic pressure spike during cruise (exceeds 3100 PSI limit)
  { tail: '418', phase: 'cruise',  param: 'hydraulic_pressure_psi', peak: 1.13, startAt: 10 },
  // Tail 423 — EGT exceedance during climb (enters warning zone ~585°C)
  { tail: '423', phase: 'climb',   param: 'egt_celsius',            peak: 1.12, startAt: 8  },
  // Tail 431 — brake temperature during landing (warning zone ~355°C)
  { tail: '431', phase: 'landing', param: 'brake_temp_celsius',     peak: 1.16, startAt: 3  },
];

// ── Pseudo-random number generator (deterministic per flight) ──────
function makePrng(seed: number) {
  let s = seed >>> 0;
  return (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 0xFFFFFFFF) * 2 - 1; // range: -1 … +1
  };
}

// ── Core generator ─────────────────────────────────────────────────
function generateFlightRecords(
  tail: string,
  pilot: string,
  missionType: string,
  flightId: string,
  startMs: number,
  seed: number,
): CSVRecord[] {
  const rand = makePrng(seed);
  const records: CSVRecord[] = [];
  let ts = startMs;
  let globalIdx = 0;

  for (const { phase, count } of PHASE_TIMELINE) {
    const base = PHASE_BASELINES[phase];
    const anomaly = ANOMALIES.find(a => a.tail === tail && a.phase === phase);

    for (let i = 0; i < count; i++) {
      const row: CSVRecord = {
        flight_id: flightId,
        tail_number: tail,
        timestamp: new Date(ts).toISOString(),
        phase,
        pilot_name: pilot,
        mission_type: missionType,
      };

      const fuelFraction = 1 - (globalIdx / TOTAL_RECORDS) * 0.69;

      for (const param of DEMO_PARAMETERS) {
        let val = base[param];
        if (param === 'fuel_remaining_lbs') val = 7200 * fuelFraction;

        // Smooth anomaly arc (sin curve)
        if (anomaly && anomaly.param === param && i >= anomaly.startAt) {
          const progress = (i - anomaly.startAt) / (count - anomaly.startAt);
          const spike = Math.sin(progress * Math.PI);
          val *= 1 + (anomaly.peak - 1) * spike;
        }

        val += rand() * PARAM_NOISE[param];

        // Clamp to physical limits
        if (param === 'g_force')    val = Math.max(-4.5, Math.min(9.8, val));
        if (param === 'n1_pct')     val = Math.max(0, Math.min(111, val));
        if (param === 'voltage_v')  val = Math.max(19, Math.min(33, val));
        if (param === 'oil_pressure') val = Math.max(8, Math.min(135, val));
        if (param === 'altitude')   val = Math.max(0, val);
        if (param === 'airspeed')   val = Math.max(0, val);
        if (param === 'fuel_flow_pph') val = Math.max(0, val);
        if (param === 'fuel_remaining_lbs') val = Math.max(0, val);

        row[param] = parseFloat(val.toFixed(2));
      }

      records.push(row);
      ts += 15_000;
      globalIdx++;
    }
  }

  return records;
}

// ── Public API ─────────────────────────────────────────────────────
export function generateDemoFlights(): {
  processedFlights: ProcessedFlight[];
  rawData: CSVRecord[];
  availableParameters: string[];
} {
  const processedFlights: ProcessedFlight[] = [];
  const rawData: CSVRecord[] = [];

  // Spread sorties over 7 days, ~2 flights per aircraft
  const baseMs = new Date('2026-03-30T06:00:00Z').getTime();
  let flightIndex = 0;

  for (let day = 0; day < 7; day++) {
    for (let acIdx = 0; acIdx < AIRCRAFT.length; acIdx++) {
      // Sparse schedule — ~60% of slots are flown
      if ((day * 3 + acIdx * 7) % 5 === 3) continue;

      const ac = AIRCRAFT[acIdx];
      const mission = MISSION_TYPES[(day + acIdx * 2) % MISSION_TYPES.length];
      const startMs = baseMs + day * 86_400_000 + acIdx * 3_600_000 + 28_800_000;
      const flightId = `F${String(day + 1).padStart(2, '0')}-${ac.tail}-${String(flightIndex + 1).padStart(3, '0')}`;

      const records = generateFlightRecords(ac.tail, ac.pilot, mission, flightId, startMs, parseInt(ac.tail) + flightIndex * 17);
      const phases = [...new Set(records.map(r => r.phase))];

      processedFlights.push({
        flight_id: flightId,
        tail_number: ac.tail,
        records,
        phases,
        startTime: records[0].timestamp,
        endTime: records[records.length - 1].timestamp,
        parameters: [...DEMO_PARAMETERS],
      });

      rawData.push(...records);
      flightIndex++;
    }
  }

  return {
    processedFlights,
    rawData,
    availableParameters: [...DEMO_PARAMETERS],
  };
}
