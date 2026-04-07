"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemStateRouter = void 0;
const express_1 = require("express");
const db_1 = require("../database/db");
const auth_middleware_1 = require("../middleware/auth-middleware");
const uuid_1 = require("uuid");
exports.systemStateRouter = (0, express_1.Router)();
function getEmergencyMode() {
    const db = (0, db_1.getDb)();
    const row = db.prepare("SELECT value FROM system_state WHERE key = 'emergency_mode'").get();
    if (!row) {
        return { active: false, reason: null, activatedBy: null, activatedAt: null };
    }
    try {
        return JSON.parse(row.value);
    }
    catch {
        return { active: false, reason: null, activatedBy: null, activatedAt: null };
    }
}
// GET /api/system/state — public read (no auth required — clients need this on load)
exports.systemStateRouter.get('/state', (_req, res) => {
    try {
        const emergencyMode = getEmergencyMode();
        res.json({ emergencyMode });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to read system state' });
    }
});
// POST /api/system/emergency — requires auth + commander role
exports.systemStateRouter.post('/emergency', auth_middleware_1.requireAuth, (req, res) => {
    const db = (0, db_1.getDb)();
    const user = req.user;
    // Only commander can change emergency mode
    if (!user || user.role !== 'commander') {
        return res.status(403).json({
            error: 'Forbidden',
            errorHe: 'רק מפקד יכול לשנות מצב חירום',
        });
    }
    const { active, reason } = req.body;
    if (typeof active !== 'boolean') {
        return res.status(400).json({ error: 'active (boolean) is required' });
    }
    if (active && (!reason || !reason.trim())) {
        return res.status(400).json({
            error: 'reason is required to activate emergency mode',
            errorHe: 'נדרשת סיבה להפעלת מצב חירום',
        });
    }
    const newState = {
        active,
        reason: active ? reason.trim() : null,
        activatedBy: active ? user.id : null,
        activatedAt: active ? new Date().toISOString() : null,
    };
    db.prepare(`
    INSERT INTO system_state (key, value, updated_by, updated_at, note)
    VALUES ('emergency_mode', ?, ?, datetime('now'), ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at,
      note = excluded.note
  `).run(JSON.stringify(newState), user.id, active ? `Activated: ${reason}` : 'Deactivated');
    // Audit log entry
    db.prepare(`
    INSERT INTO audit_log (id, actor_id, actor_role, action, entity_type, entity_id, new_value, note, timestamp)
    VALUES (?, ?, ?, ?, 'system', 'emergency_mode', ?, ?, datetime('now'))
  `).run((0, uuid_1.v4)(), user.id, user.role, active ? 'emergency.activated' : 'emergency.deactivated', JSON.stringify(newState), active ? `Emergency mode activated: ${reason}` : 'Emergency mode deactivated');
    return res.json({ success: true, emergencyMode: newState });
});
//# sourceMappingURL=system-state.js.map