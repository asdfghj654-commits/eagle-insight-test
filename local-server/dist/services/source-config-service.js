"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceConfigService = void 0;
const db_1 = require("../database/db");
const flight_data_adapter_1 = require("../adapters/flight-data-adapter");
const sql_adapter_1 = require("../adapters/sql-adapter");
const file_adapter_1 = require("../adapters/file-adapter");
const api_adapter_1 = require("../adapters/api-adapter");
exports.sourceConfigService = {
    list() {
        const rows = (0, db_1.getDb)().prepare(`
      SELECT * FROM source_configs
      ORDER BY created_at DESC, id DESC
    `).all();
        return rows.map(rowToSourceConfig);
    },
    getById(id) {
        const row = (0, db_1.getDb)().prepare('SELECT * FROM source_configs WHERE id = ?').get(id);
        return row ? rowToSourceConfig(row) : null;
    },
    upsert(config) {
        const existing = this.getById(config.id);
        if (existing) {
            (0, db_1.getDb)().prepare(`
        UPDATE source_configs
        SET name = ?, type = ?, config = ?, is_active = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(config.name, config.type, JSON.stringify(config.config ?? {}), config.enabled === false ? 0 : 1, config.id);
        }
        else {
            (0, db_1.getDb)().prepare(`
        INSERT INTO source_configs
          (id, name, type, config, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(config.id, config.name, config.type, JSON.stringify(config.config ?? {}), config.enabled === false ? 0 : 1, config.createdBy ?? null);
        }
        const saved = this.getById(config.id);
        this.registerWithAdapters(saved);
        return saved;
    },
    delete(id) {
        const result = (0, db_1.getDb)().prepare('DELETE FROM source_configs WHERE id = ?').run(id);
        return result.changes > 0;
    },
    registerAll() {
        const configs = this.list().filter((config) => config.isActive);
        for (const config of configs) {
            this.registerWithAdapters(config);
        }
    },
    registerWithAdapters(record) {
        (0, flight_data_adapter_1.registerSourceType)(record.id, record.type);
        if (record.type === 'sql') {
            (0, sql_adapter_1.registerSQLSource)(record.id, record.config);
            return;
        }
        if (record.type === 'filesystem') {
            (0, file_adapter_1.registerFileSystemSource)(record.id, record.config);
            return;
        }
        if (record.type === 'api') {
            (0, api_adapter_1.registerAPISource)(record.id, record.config);
        }
    },
};
function rowToSourceConfig(row) {
    return {
        id: String(row.id),
        name: String(row.name),
        type: String(row.type),
        config: JSON.parse(String(row.config ?? '{}')),
        isActive: Number(row.is_active ?? 1) === 1,
        createdBy: row.created_by ? String(row.created_by) : undefined,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
//# sourceMappingURL=source-config-service.js.map