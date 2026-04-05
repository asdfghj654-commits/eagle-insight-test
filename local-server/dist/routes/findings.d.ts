/**
 * Findings Routes — Eagle Insight Local MVP
 *
 * GET    /api/findings          — List findings (filterable)
 * POST   /api/findings          — Create finding (from ingestion or manual)
 * GET    /api/findings/stats    — Aggregate statistics
 * GET    /api/findings/:id      — Get single finding
 * PATCH  /api/findings/:id/status  — Update status
 * PATCH  /api/findings/:id/assign  — Assign to user
 * POST   /api/findings/bulk     — Bulk create (from rule execution)
 */
export declare const findingsRouter: import("express-serve-static-core").Router;
//# sourceMappingURL=findings.d.ts.map