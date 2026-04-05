/**
 * Universal SQL Adapter
 * Supports PostgreSQL, MySQL, MSSQL, SQLite, and more
 */
interface SQLConfig {
    dialect: 'postgresql' | 'mysql' | 'mssql' | 'sqlite' | 'oracle' | 'vertica';
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    ssl?: boolean;
}
interface QueryOptions {
    query: string;
    parameters?: Record<string, any>;
    limit?: number;
    offset?: number;
    timeout?: number;
}
interface QueryResult {
    rows: any[];
    rowCount: number;
    columns: string[];
}
export declare function registerSQLSource(sourceId: string, config: SQLConfig): void;
export declare function testSQLConnection(config: SQLConfig): Promise<{
    success: boolean;
    message: string;
}>;
export declare function executeSQL(sourceId: string, options: QueryOptions): Promise<QueryResult>;
export {};
//# sourceMappingURL=sql-adapter.d.ts.map