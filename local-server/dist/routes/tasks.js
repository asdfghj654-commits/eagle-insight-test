"use strict";
/**
 * Tasks Routes — Eagle Insight Local MVP
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tasksRouter = void 0;
const express_1 = require("express");
const tasks_service_1 = require("../services/tasks-service");
const auth_middleware_1 = require("../middleware/auth-middleware");
exports.tasksRouter = (0, express_1.Router)();
exports.tasksRouter.use(auth_middleware_1.requireAuth);
// GET /api/tasks
exports.tasksRouter.get('/', (req, res) => {
    const { findingId, assignedTo, status } = req.query;
    const tasks = tasks_service_1.tasksService.list({
        findingId: findingId ? String(findingId) : undefined,
        assignedTo: assignedTo ? String(assignedTo) : undefined,
        status: status ? String(status).split(',') : undefined,
    });
    return res.json({ tasks, count: tasks.length });
});
// GET /api/tasks/:id
exports.tasksRouter.get('/:id', (req, res) => {
    const task = tasks_service_1.tasksService.getById(req.params.id);
    if (!task)
        return res.status(404).json({ error: 'Task not found' });
    return res.json({ task });
});
// POST /api/tasks
exports.tasksRouter.post('/', (req, res) => {
    const body = req.body;
    if (!body.title)
        return res.status(400).json({ error: 'title is required' });
    try {
        const task = tasks_service_1.tasksService.create(body, req.authUser?.id, req.authUser?.role);
        return res.status(201).json({ task });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// PATCH /api/tasks/:id/status
exports.tasksRouter.patch('/:id/status', (req, res) => {
    const { status, note } = req.body;
    const valid = ['open', 'in_progress', 'completed', 'deferred', 'rejected'];
    if (!valid.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Valid: ${valid.join(', ')}` });
    }
    const updated = tasks_service_1.tasksService.updateStatus(req.params.id, status, req.authUser.id, req.authUser.role, note);
    if (!updated)
        return res.status(404).json({ error: 'Task not found' });
    return res.json({ task: updated });
});
// POST /api/tasks/:id/complete
exports.tasksRouter.post('/:id/complete', (req, res) => {
    const { outcome, outcomeType } = req.body;
    const validOutcomes = ['fixed', 'replaced', 'nff', 'deferred', 'rejected'];
    if (!outcome || !validOutcomes.includes(outcomeType)) {
        return res.status(400).json({
            error: `outcome and outcomeType required. Valid types: ${validOutcomes.join(', ')}`
        });
    }
    const updated = tasks_service_1.tasksService.complete(req.params.id, req.authUser.id, req.authUser.role, outcome, outcomeType);
    if (!updated)
        return res.status(404).json({ error: 'Task not found' });
    return res.json({ task: updated });
});
//# sourceMappingURL=tasks.js.map