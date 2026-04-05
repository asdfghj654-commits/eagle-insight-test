/**
 * Rules API Routes — Eagle Insight Local MVP
 *
 * GET    /api/rules         — List rules (optionally filter by type/status)
 * GET    /api/rules/:id     — Get single rule
 * POST   /api/rules         — Create engineer rule (engineer only)
 * PATCH  /api/rules/:id/approve   — Approve rule (engineer only)
 * PATCH  /api/rules/:id/threshold — Update threshold (engineer only, triggers re-approval)
 * PATCH  /api/rules/:id/status    — Pause / deprecate rule
 */
export declare const rulesApiRouter: import("express-serve-static-core").Router;
//# sourceMappingURL=rules-api.d.ts.map