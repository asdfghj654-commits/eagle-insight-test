/**
 * Chart Colors Utility
 * 
 * Provides a consistent, accessible color palette for multi-series charts.
 * Colors are optimized for:
 * - Visual distinction between series
 * - Color blindness accessibility
 * - Good contrast on light/dark backgrounds
 */

// Primary color palette - 10 distinct colors
export const CHART_COLORS = [
  '#2563eb', // Blue (primary)
  '#dc2626', // Red
  '#16a34a', // Green
  '#ea580c', // Orange
  '#7c3aed', // Purple
  '#0891b2', // Cyan
  '#ca8a04', // Amber
  '#be185d', // Pink
  '#4f46e5', // Indigo
  '#059669', // Teal
] as const;

// Extended palette for more series
export const EXTENDED_COLORS = [
  ...CHART_COLORS,
  '#6366f1', // Light indigo
  '#f97316', // Light orange
  '#10b981', // Emerald
  '#8b5cf6', // Light purple
  '#06b6d4', // Light cyan
  '#f59e0b', // Yellow
  '#ec4899', // Light pink
  '#14b8a6', // Light teal
  '#6b7280', // Gray
  '#3b82f6', // Light blue
];

/**
 * Get a color for a series by index
 * Cycles through the palette if index exceeds available colors
 */
export const getSeriesColor = (index: number): string => {
  return EXTENDED_COLORS[index % EXTENDED_COLORS.length];
};

/**
 * Get a deterministic color for a parameter name
 * Same parameter always gets same color
 */
export const getParameterColor = (paramName: string): string => {
  // Simple hash to get consistent color per parameter
  let hash = 0;
  for (let i = 0; i < paramName.length; i++) {
    hash = ((hash << 5) - hash) + paramName.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return EXTENDED_COLORS[Math.abs(hash) % EXTENDED_COLORS.length];
};

/**
 * HSL color variants of the palette for theming
 */
export const CHART_COLORS_HSL = [
  'hsl(217, 91%, 60%)',  // Blue
  'hsl(0, 72%, 51%)',    // Red
  'hsl(142, 71%, 45%)',  // Green
  'hsl(25, 95%, 53%)',   // Orange
  'hsl(263, 70%, 50%)',  // Purple
  'hsl(189, 94%, 43%)',  // Cyan
  'hsl(46, 97%, 65%)',   // Amber
  'hsl(330, 81%, 60%)',  // Pink
  'hsl(239, 84%, 67%)',  // Indigo
  'hsl(162, 94%, 39%)',  // Teal
];

/**
 * Get contrasting text color for a background
 */
export const getContrastTextColor = (bgColor: string): string => {
  // For simplicity, check if it's a "light" color
  // In production, would calculate actual luminance
  const lightColors = ['#ca8a04', '#f59e0b', '#fbbf24'];
  return lightColors.includes(bgColor) ? '#1f2937' : '#ffffff';
};

/**
 * Severity-based colors (aligned with S1-S4)
 */
export const SEVERITY_COLORS = {
  S1: '#dc2626', // Red - critical
  S2: '#ea580c', // Orange - high
  S3: '#ca8a04', // Amber - medium
  S4: '#2563eb', // Blue - info
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#2563eb',
};

/**
 * Status colors for UI elements
 */
export const STATUS_COLORS = {
  success: '#16a34a',
  warning: '#ea580c',
  error: '#dc2626',
  info: '#2563eb',
  neutral: '#6b7280',
};
