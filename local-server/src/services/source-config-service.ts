import { getDb } from '../database/db';
import { registerSourceType } from '../adapters/flight-data-adapter';
import { registerSQLSource } from '../adapters/sql-adapter';
import { registerFileSystemSource } from '../adapters/file-adapter';
import { registerAPISource } from '../adapters/api-adapter';

export interface SourceConfigRecord {
  id: string;
  name: string;
  type: 'sql' | 'filesystem' | 'api';
  config: Record<string, unknown>;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const sourceConfigService = {
  list(): SourceConfigRecord[] {
    const rows = getDb().prepare(`
      SELECT * FROM source_configs
      ORDER BY created_at DESC, id DESC
    `).all() as Array<Record<string, unknown>>;

    return rows.map(rowToSourceConfig);
  },

  getById(id: string): SourceConfigRecord | null {
    const row = getDb().prepare('SELECT * FROM source_configs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToSourceConfig(row) : null;
  },

  upsert(config: {
    id: string;
    name: string;
    type: 'sql' | 'filesystem' | 'api';
    config: Record<string, unknown>;
    enabled?: boolean;
    createdBy?: string;
  }): SourceConfigRecord {
    const existing = this.getById(config.id);

    if (existing) {
      getDb().prepare(`
        UPDATE source_configs
        SET name = ?, type = ?, config = ?, is_active = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        config.name,
        config.type,
        JSON.stringify(config.config ?? {}),
        config.enabled === false ? 0 : 1,
        config.id,
      );
    } else {
      getDb().prepare(`
        INSERT INTO source_configs
          (id, name, type, config, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        config.id,
        config.name,
        config.type,
        JSON.stringify(config.config ?? {}),
        config.enabled === false ? 0 : 1,
        config.createdBy ?? null,
      );
    }

    const saved = this.getById(config.id)!;
    this.registerWithAdapters(saved);
    return saved;
  },

  delete(id: string): boolean {
    const result = getDb().prepare('DELETE FROM source_configs WHERE id = ?').run(id);
    return result.changes > 0;
  },

  registerAll(): void {
    const configs = this.list().filter((config) => config.isActive);
    for (const config of configs) {
      this.registerWithAdapters(config);
    }
  },

  registerWithAdapters(record: SourceConfigRecord): void {
    registerSourceType(record.id, record.type);

    if (record.type === 'sql') {
      registerSQLSource(record.id, record.config as any);
      return;
    }

    if (record.type === 'filesystem') {
      registerFileSystemSource(record.id, record.config as any);
      return;
    }

    if (record.type === 'api') {
      registerAPISource(record.id, record.config as any);
    }
  },
};

function rowToSourceConfig(row: Record<string, unknown>): SourceConfigRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    type: String(row.type) as 'sql' | 'filesystem' | 'api',
    config: JSON.parse(String(row.config ?? '{}')),
    isActive: Number(row.is_active ?? 1) === 1,
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
