/**
 * Database Module — Eagle Insight Local MVP
 *
 * Uses Node.js built-in `node:sqlite` (available in Node v22.5+).
 * No native bindings required — works out of the box on Windows.
 *
 * DatabaseSync API mirrors better-sqlite3 semantics (synchronous),
 * making service code simple and predictable.
 */
type Row = Record<string, any>;
interface Statement {
    run(...params: unknown[]): {
        changes: number;
        lastInsertRowid: number | bigint;
    };
    get(...params: unknown[]): Row | undefined;
    all(...params: unknown[]): Row[];
}
declare class Db {
    private _db;
    constructor(dbPath: string);
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
}
export declare const DATA_DIR: string;
export declare const DB_PATH: string;
export declare function getDb(): Db;
export {};
//# sourceMappingURL=db.d.ts.map