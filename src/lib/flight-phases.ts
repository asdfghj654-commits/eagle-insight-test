/**
 * Flight Phases Utility
 * 
 * Professional aviation flight phase definitions and utilities.
 * Provides consistent phase naming across the application.
 */

export interface FlightPhaseInfo {
  en: string;
  he: string;
  order: number;
  description?: string;
  color?: string;
}

/**
 * Standard aviation flight phases
 */
export const FLIGHT_PHASES = {
  taxi: {
    en: 'TAXI',
    he: 'טקסי',
    order: 1,
    description: 'Ground movement before takeoff',
    color: 'hsl(210, 40%, 60%)',
  },
  takeoff: {
    en: 'TAKEOFF',
    he: 'המראה',
    order: 2,
    description: 'Acceleration and initial climb',
    color: 'hsl(45, 80%, 55%)',
  },
  climb: {
    en: 'CLIMB',
    he: 'עלייה',
    order: 3,
    description: 'Ascending to cruise altitude',
    color: 'hsl(120, 50%, 50%)',
  },
  cruise: {
    en: 'CRUISE',
    he: 'טיסת שיוט',
    order: 4,
    description: 'Level flight at altitude',
    color: 'hsl(200, 60%, 50%)',
  },
  descent: {
    en: 'DESCENT',
    he: 'ירידה',
    order: 5,
    description: 'Descending from cruise altitude',
    color: 'hsl(280, 50%, 55%)',
  },
  approach: {
    en: 'APPROACH',
    he: 'גישה',
    order: 6,
    description: 'Final approach to runway',
    color: 'hsl(30, 70%, 55%)',
  },
  landing: {
    en: 'LANDING',
    he: 'נחיתה',
    order: 7,
    description: 'Touchdown and rollout',
    color: 'hsl(0, 60%, 55%)',
  },
  holding: {
    en: 'HOLDING',
    he: 'המתנה',
    order: 3.5,
    description: 'Holding pattern',
    color: 'hsl(180, 50%, 50%)',
  },
  maneuver: {
    en: 'MANEUVER',
    he: 'מנאוברה',
    order: 4.5,
    description: 'Special maneuvers or combat',
    color: 'hsl(350, 70%, 55%)',
  },
} as const;

export type FlightPhase = keyof typeof FLIGHT_PHASES;

/**
 * Hebrew to English phase mapping
 */
const HEBREW_PHASE_MAP: Record<string, FlightPhase> = {
  'טקסי': 'taxi',
  'המראה': 'takeoff',
  'עלייה': 'climb',
  'טיסת שיוט': 'cruise',
  'שיוט': 'cruise',
  'ירידה': 'descent',
  'גישה': 'approach',
  'נחיתה': 'landing',
  'המתנה': 'holding',
  'מנאוברה': 'maneuver',
};

/**
 * Numeric phase mapping (for legacy data)
 */
const NUMERIC_PHASE_MAP: Record<number, FlightPhase> = {
  1: 'taxi',
  2: 'takeoff',
  3: 'climb',
  4: 'cruise',
  5: 'descent',
  6: 'approach',
  7: 'landing',
  8: 'holding',
  9: 'maneuver',
  10: 'cruise', // default for unknown
  11: 'cruise',
};

/**
 * Normalize a phase value to a standard FlightPhase key
 */
export const normalizePhase = (phase: string | number): FlightPhase => {
  // Handle numeric phases
  if (typeof phase === 'number') {
    return NUMERIC_PHASE_MAP[phase] || 'cruise';
  }
  
  const phaseLower = phase.toLowerCase().trim();
  
  // Direct match
  if (phaseLower in FLIGHT_PHASES) {
    return phaseLower as FlightPhase;
  }
  
  // Hebrew match
  if (HEBREW_PHASE_MAP[phase]) {
    return HEBREW_PHASE_MAP[phase];
  }
  
  // Numeric string
  const numPhase = parseInt(phase, 10);
  if (!isNaN(numPhase) && NUMERIC_PHASE_MAP[numPhase]) {
    return NUMERIC_PHASE_MAP[numPhase];
  }
  
  // Default
  return 'cruise';
};

/**
 * Get the display label for a phase
 */
export const getPhaseLabel = (phase: string | number, lang: 'he' | 'en' = 'he'): string => {
  const normalized = normalizePhase(phase);
  const phaseInfo = FLIGHT_PHASES[normalized];
  return lang === 'he' ? phaseInfo.he : phaseInfo.en;
};

/**
 * Get all phase information
 */
export const getPhaseInfo = (phase: string | number): FlightPhaseInfo => {
  const normalized = normalizePhase(phase);
  return FLIGHT_PHASES[normalized];
};

/**
 * Get color for a phase (for charts/UI)
 */
export const getPhaseColor = (phase: string | number): string => {
  const normalized = normalizePhase(phase);
  return FLIGHT_PHASES[normalized].color || 'hsl(200, 60%, 50%)';
};

/**
 * Get all phases sorted by order
 */
export const getAllPhasesSorted = (): Array<{ key: FlightPhase; info: FlightPhaseInfo }> => {
  return Object.entries(FLIGHT_PHASES)
    .map(([key, info]) => ({ key: key as FlightPhase, info }))
    .sort((a, b) => a.info.order - b.info.order);
};

/**
 * Check if a value is a valid flight phase
 */
export const isValidPhase = (value: any): boolean => {
  if (typeof value === 'number') {
    return value in NUMERIC_PHASE_MAP;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() in FLIGHT_PHASES || value in HEBREW_PHASE_MAP;
  }
  return false;
};

/**
 * Infer mission type from a flight's telemetry records.
 * Returns 'combat', 'weather_hard', or 'training'.
 */
export function inferMissionTypeFromRecords(
  records: Array<Record<string, number | string | undefined>>,
): 'training' | 'combat' | 'weather_hard' {
  if (records.length === 0) return 'training';

  const num = (rec: Record<string, number | string | undefined>, key: string): number | undefined => {
    const v = rec[key];
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(v as string);
    return Number.isFinite(n) ? n : undefined;
  };

  let maxG = 0;
  let countHighG = 0;

  for (const rec of records) {
    const g = num(rec, 'g_load') ?? num(rec, 'g_force') ?? 0;
    if (g > maxG) maxG = g;
    if (g > 4.0) countHighG += 1;
  }

  // High sustained G-load → combat profile
  if (maxG > 6.5 || countHighG > 5) return 'combat';
  if (maxG > 4.5 || countHighG > 2) return 'combat';

  // No other signals to distinguish weather_hard without dedicated param
  return 'training';
}

/**
 * Infer flight phase from telemetry parameters.
 * Used when the CSV / data source does not supply a phase column.
 *
 * Priority order: g-force/AoA extremes → ground/speed → vertical speed → altitude → fallback cruise.
 */
export function inferPhaseFromTelemetry(
  params: Record<string, number | string | undefined>,
): FlightPhase {
  const num = (key: string): number | undefined => {
    const v = params[key];
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(v as string);
    return Number.isFinite(n) ? n : undefined;
  };

  const alt = num('altitude_ft');
  const vs  = num('vertical_speed_fpm');
  const spd = num('airspeed_kts') ?? num('landing_speed_kts');
  const g   = num('g_load') ?? num('g_force');
  const aoa = num('angle_of_attack_deg') ?? num('aoa_deg');
  const brk = num('brake_temp_celsius');

  // Extreme maneuver signature
  if ((g !== undefined && Math.abs(g) > 2.5) || (aoa !== undefined && Math.abs(aoa) > 15)) {
    return 'maneuver';
  }

  // Ground operations — low altitude + speed
  if (alt !== undefined && alt < 300) {
    if (spd === undefined || spd < 30) return 'taxi';
    if (vs !== undefined && vs > 300)  return 'takeoff';
    if (spd < 80)                       return 'landing';
    return 'takeoff';
  }

  // Speed-only ground hint (no altitude data)
  if (alt === undefined && spd !== undefined && spd < 30) return 'taxi';

  // Hot brakes near ground
  if (brk !== undefined && brk > 150 && (alt === undefined || alt < 1000)) {
    return 'landing';
  }

  // Vertical speed based
  if (vs !== undefined) {
    if (vs >  800) return alt !== undefined && alt < 5000 ? 'takeoff' : 'climb';
    if (vs >  200) return 'climb';
    if (vs < -800) return alt !== undefined && alt < 5000 ? 'approach' : 'descent';
    if (vs < -200) return alt !== undefined && alt < 8000 ? 'approach' : 'descent';
  }

  // Altitude-only hints
  if (alt !== undefined) {
    if (alt < 1500) return 'approach';
    if (alt < 5000) return 'climb';
    return 'cruise';
  }

  // No useful parameters — default
  return 'cruise';
}
