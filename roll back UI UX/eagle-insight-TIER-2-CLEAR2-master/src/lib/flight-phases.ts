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
