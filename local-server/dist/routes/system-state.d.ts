/**
 * System State Route — Eagle Insight
 *
 * Persists and retrieves operational system state:
 * - Emergency mode (activate / deactivate, with audit trail)
 * - Future: feature flags, system version, maintenance windows
 *
 * Emergency mode is now persisted to SQLite system_state table.
 * This means it survives server restarts and is visible across all clients.
 */
export declare const systemStateRouter: import("express-serve-static-core").Router;
//# sourceMappingURL=system-state.d.ts.map