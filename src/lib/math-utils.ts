/**
 * math-utils.ts — Shared statistical helpers
 *
 * Centralised to avoid duplication across CorrelationsTab and DistributionsTab.
 */

// ─── Linear regression ────────────────────────────────────────────────────────

export interface RegressionResult {
  slope: number;
  intercept: number;
  stdDev: number;
  rSquared: number;
  /** Pearson r (sign-aware sqrt of R²) */
  r: number;
  residuals: number[];
}

export function computeLinearRegression(
  pts: { x: number; y: number }[]
): RegressionResult | null {
  const n = pts.length;
  if (n < 3) return null;

  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const { x, y } of pts) { sx += x; sy += y; sxy += x * y; sxx += x * x; }

  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;

  const slope     = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;

  const residuals = pts.map(({ x, y }) => y - (slope * x + intercept));
  const meanR     = residuals.reduce((a, b) => a + b, 0) / n;
  const stdDev    = Math.sqrt(residuals.reduce((a, r) => a + (r - meanR) ** 2, 0) / n);

  const ssTot   = pts.reduce((a, { y }) => a + (y - sy / n) ** 2, 0);
  const ssRes   = residuals.reduce((a, r) => a + r ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const r        = Math.sign(slope) * Math.sqrt(Math.max(0, rSquared));

  return { slope, intercept, stdDev, rSquared, r, residuals };
}

// ─── Pearson correlation ──────────────────────────────────────────────────────

export function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const meanX = x.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanY = y.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, sqX = 0, sqY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX, dy = y[i] - meanY;
    num += dx * dy; sqX += dx * dx; sqY += dy * dy;
  }
  const denom = Math.sqrt(sqX * sqY);
  return denom === 0 ? 0 : num / denom;
}
