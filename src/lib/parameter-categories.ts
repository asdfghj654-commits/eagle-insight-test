import { Cog, Gauge, Thermometer, Plane, Activity, Zap, Droplets, Settings } from 'lucide-react';

export interface ParameterCategory {
  name: string;
  icon: any;
  color: string;
  keywords: string[];
}

// Parameter units for professional display
export const PARAMETER_UNITS: Record<string, string> = {
  // Flight parameters
  altitude: 'ft',
  airspeed: 'kts',
  vertical_speed: 'ft/min',
  mach: 'M',
  aoa: '°',
  pitch: '°',
  roll: '°',
  yaw: '°',
  heading: '°',
  track: '°',
  g_force: 'G',
  
  // Engine parameters
  engine_temp: '°C',
  egt: '°C',
  itt: '°C',
  n1: '%',
  n2: '%',
  epr: '',
  fuel_flow: 'lbs/hr',
  oil_temp: '°C',
  oil_pressure: 'PSI',
  thrust: 'lbs',
  
  // Hydraulics
  hydraulic_pressure: 'PSI',
  hyd_pressure: 'PSI',
  reservoir_level: '%',
  
  // Electrical
  voltage: 'V',
  current: 'A',
  battery: '%',
  
  // Temperatures
  temp: '°C',
  temperature: '°C',
  brake_temp: '°C',
  
  // General
  pressure: 'PSI',
  flow: 'gpm',
  level: '%',
};

// Human-readable parameter labels (Hebrew)
export const PARAMETER_LABELS_HE: Record<string, string> = {
  altitude: 'גובה',
  airspeed: 'מהירות אוויר',
  vertical_speed: 'מהירות אנכית',
  engine_temp: 'טמפרטורת מנוע',
  fuel_flow: 'צריכת דלק',
  oil_pressure: 'לחץ שמן',
  hydraulic_pressure: 'לחץ הידראולי',
  g_force: 'עומס G',
  egt: 'EGT',
  heading: 'כיוון',
  pitch: 'זווית Pitch',
  roll: 'זווית Roll',
};

/**
 * Get the unit for a parameter
 */
export const getParameterUnit = (param: string): string => {
  const paramLower = param.toLowerCase();
  
  // Direct match
  if (PARAMETER_UNITS[paramLower]) {
    return PARAMETER_UNITS[paramLower];
  }
  
  // Partial match
  for (const [key, unit] of Object.entries(PARAMETER_UNITS)) {
    if (paramLower.includes(key) || key.includes(paramLower)) {
      return unit;
    }
  }
  
  return '';
};

/**
 * Get a professional label for a parameter with optional unit
 */
export const getParameterLabel = (param: string, includeUnit = true): string => {
  const unit = getParameterUnit(param);
  const label = PARAMETER_LABELS_HE[param.toLowerCase()] || param;
  
  if (includeUnit && unit) {
    return `${label} (${unit})`;
  }
  return label;
};

/**
 * Format a parameter value with its unit
 */
export const formatParameterValue = (param: string, value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  
  const unit = getParameterUnit(param);
  const formatted = typeof value === 'number' ? value.toFixed(2) : String(value);
  
  return unit ? `${formatted} ${unit}` : formatted;
};

export const PARAMETER_CATEGORIES: Record<string, ParameterCategory> = {
  engine: {
    name: 'מנוע',
    icon: Cog,
    color: 'hsl(0, 70%, 60%)',
    keywords: ['engine', 'egt', 'itt', 'n1', 'n2', 'epr', 'fuel_flow', 'oil', 'temp', 'thrust']
  },
  hydraulics: {
    name: 'הידראוליקה',
    icon: Droplets,
    color: 'hsl(200, 80%, 50%)',
    keywords: ['hydraulic', 'pressure', 'hyd', 'pump', 'reservoir', 'fluid']
  },
  flight_systems: {
    name: 'מערכות טיסה',
    icon: Plane,
    color: 'hsl(120, 60%, 50%)',
    keywords: ['altitude', 'airspeed', 'mach', 'aoa', 'pitch', 'roll', 'yaw', 'heading', 'track']
  },
  temperatures: {
    name: 'טמפרטורות',
    icon: Thermometer,
    color: 'hsl(30, 80%, 55%)',
    keywords: ['temp', 'temperature', 'hot', 'cold', 'thermal', 'heat']
  },
  electrical: {
    name: 'חשמל',
    icon: Zap,
    color: 'hsl(45, 80%, 60%)',
    keywords: ['voltage', 'current', 'electrical', 'battery', 'generator', 'power', 'amp', 'volt']
  },
  gauges: {
    name: 'מדדים',
    icon: Gauge,
    color: 'hsl(280, 60%, 50%)',
    keywords: ['gauge', 'indicator', 'meter', 'level', 'quantity', 'flow', 'rate']
  },
  avionics: {
    name: 'אוויוניקה',
    icon: Activity,
    color: 'hsl(180, 65%, 45%)',
    keywords: ['radio', 'nav', 'communication', 'gps', 'ils', 'vor', 'adf', 'transponder']
  },
  other: {
    name: 'אחר',
    icon: Settings,
    color: 'hsl(220, 50%, 50%)',
    keywords: []
  }
};

export const getParameterCategory = (parameter: string): string => {
  const paramLower = parameter.toLowerCase();
  
  for (const [categoryKey, category] of Object.entries(PARAMETER_CATEGORIES)) {
    if (category.keywords.some(keyword => paramLower.includes(keyword))) {
      return categoryKey;
    }
  }
  
  return 'other';
};