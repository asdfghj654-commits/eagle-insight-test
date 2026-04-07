/**
 * Universal SQL Adapter
 * Supports PostgreSQL, MySQL, MSSQL, SQLite, and more
 */

import { logger } from '../utils/logger';

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

// In-memory storage for source configs
const sourceConfigs = new Map<string, SQLConfig>();

// Connection pools for different databases
const connectionPools = new Map<string, any>();

export function registerSQLSource(sourceId: string, config: SQLConfig): void {
  sourceConfigs.set(sourceId, config);
}

export async function testSQLConnection(config: SQLConfig): Promise<{ success: boolean; message: string }> {
  try {
    switch (config.dialect) {
      case 'postgresql': {
        const { Pool } = await import('pg');
        const pool = new Pool({
          connectionString: config.connectionString,
          host: config.host,
          port: config.port || 5432,
          database: config.database,
          user: config.username,
          password: config.password,
          ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        });
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        await pool.end();
        return { success: true, message: 'PostgreSQL connection successful' };
      }
      
      case 'mysql': {
        const mysql = await import('mysql2/promise');
        const connection = await mysql.createConnection({
          host: config.host,
          port: config.port || 3306,
          database: config.database,
          user: config.username,
          password: config.password,
        });
        await connection.query('SELECT 1');
        await connection.end();
        return { success: true, message: 'MySQL connection successful' };
      }
      
      case 'mssql': {
        const sql = await import('mssql');
        await sql.connect({
          server: config.host || 'localhost',
          port: config.port || 1433,
          database: config.database,
          user: config.username,
          password: config.password,
          options: {
            encrypt: config.ssl !== false,
            trustServerCertificate: true,
          },
        });
        await sql.query`SELECT 1`;
        await sql.close();
        return { success: true, message: 'MSSQL connection successful' };
      }
      
      case 'sqlite': {
        const Database = (await import('better-sqlite3')).default;
        const db = new Database(config.database || ':memory:');
        db.prepare('SELECT 1').get();
        db.close();
        return { success: true, message: 'SQLite connection successful' };
      }
      
      default:
        return { success: false, message: `Unsupported dialect: ${config.dialect}` };
    }
  } catch (error) {
    logger.error('SQL connection test failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

export async function executeSQL(sourceId: string, options: QueryOptions): Promise<QueryResult> {
  const config = sourceConfigs.get(sourceId);
  
  if (!config) {
    throw new Error(`SQL source not found: ${sourceId}`);
  }
  
  // Apply limit and offset
  let finalQuery = options.query;
  if (options.limit && !options.query.toLowerCase().includes('limit')) {
    finalQuery += ` LIMIT ${options.limit}`;
    if (options.offset) {
      finalQuery += ` OFFSET ${options.offset}`;
    }
  }
  
  logger.info(`Executing SQL on ${config.dialect}: ${finalQuery.substring(0, 100)}...`);
  
  try {
    switch (config.dialect) {
      case 'postgresql': {
        const { Pool } = await import('pg');
        let pool = connectionPools.get(sourceId);
        if (!pool) {
          pool = new Pool({
            connectionString: config.connectionString,
            host: config.host,
            port: config.port || 5432,
            database: config.database,
            user: config.username,
            password: config.password,
            ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
            max: 10,
          });
          connectionPools.set(sourceId, pool);
        }
        const result = await pool.query(finalQuery, Object.values(options.parameters || {}));
        return {
          rows: result.rows,
          rowCount: result.rowCount || result.rows.length,
          columns: result.fields?.map((f: any) => f.name) || [],
        };
      }
      
      case 'mysql': {
        const mysql = await import('mysql2/promise');
        let pool = connectionPools.get(sourceId);
        if (!pool) {
          pool = mysql.createPool({
            host: config.host,
            port: config.port || 3306,
            database: config.database,
            user: config.username,
            password: config.password,
            waitForConnections: true,
            connectionLimit: 10,
          });
          connectionPools.set(sourceId, pool);
        }
        const [rows, fields] = await pool.query(finalQuery, Object.values(options.parameters || {}));
        return {
          rows: rows as any[],
          rowCount: (rows as any[]).length,
          columns: (fields as any[]).map((f: any) => f.name),
        };
      }
      
      case 'mssql': {
        const sql = await import('mssql');
        let pool = connectionPools.get(sourceId);
        if (!pool) {
          pool = await sql.connect({
            server: config.host || 'localhost',
            port: config.port || 1433,
            database: config.database,
            user: config.username,
            password: config.password,
            pool: { max: 10 },
            options: {
              encrypt: config.ssl !== false,
              trustServerCertificate: true,
            },
          });
          connectionPools.set(sourceId, pool);
        }
        const result = await pool.request().query(finalQuery);
        return {
          rows: result.recordset,
          rowCount: result.recordset.length,
          columns: result.recordset.columns ? Object.keys(result.recordset.columns) : [],
        };
      }
      
      case 'sqlite': {
        const Database = (await import('better-sqlite3')).default;
        let db = connectionPools.get(sourceId);
        if (!db) {
          db = new Database(config.database || ':memory:');
          connectionPools.set(sourceId, db);
        }
        const stmt = db.prepare(finalQuery);
        const rows = stmt.all(options.parameters || {});
        return {
          rows,
          rowCount: rows.length,
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        };
      }
      
      default:
        throw new Error(`Unsupported SQL dialect: ${config.dialect}`);
    }
  } catch (error) {
    logger.error(`SQL execution error:`, error);
    throw error;
  }
}
