"use strict";
/**
 * Universal SQL Adapter
 * Supports PostgreSQL, MySQL, MSSQL, SQLite, and more
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSQLSource = registerSQLSource;
exports.testSQLConnection = testSQLConnection;
exports.executeSQL = executeSQL;
const logger_1 = require("../utils/logger");
// In-memory storage for source configs
const sourceConfigs = new Map();
// Connection pools for different databases
const connectionPools = new Map();
function registerSQLSource(sourceId, config) {
    sourceConfigs.set(sourceId, config);
}
async function testSQLConnection(config) {
    try {
        switch (config.dialect) {
            case 'postgresql': {
                const { Pool } = await Promise.resolve().then(() => __importStar(require('pg')));
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
                const mysql = await Promise.resolve().then(() => __importStar(require('mysql2/promise')));
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
                const sql = await Promise.resolve().then(() => __importStar(require('mssql')));
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
                await sql.query `SELECT 1`;
                await sql.close();
                return { success: true, message: 'MSSQL connection successful' };
            }
            case 'sqlite': {
                const Database = (await Promise.resolve().then(() => __importStar(require('better-sqlite3')))).default;
                const db = new Database(config.database || ':memory:');
                db.prepare('SELECT 1').get();
                db.close();
                return { success: true, message: 'SQLite connection successful' };
            }
            default:
                return { success: false, message: `Unsupported dialect: ${config.dialect}` };
        }
    }
    catch (error) {
        logger_1.logger.error('SQL connection test failed:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Connection failed',
        };
    }
}
async function executeSQL(sourceId, options) {
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
    logger_1.logger.info(`Executing SQL on ${config.dialect}: ${finalQuery.substring(0, 100)}...`);
    try {
        switch (config.dialect) {
            case 'postgresql': {
                const { Pool } = await Promise.resolve().then(() => __importStar(require('pg')));
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
                    columns: result.fields?.map((f) => f.name) || [],
                };
            }
            case 'mysql': {
                const mysql = await Promise.resolve().then(() => __importStar(require('mysql2/promise')));
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
                    rows: rows,
                    rowCount: rows.length,
                    columns: fields.map((f) => f.name),
                };
            }
            case 'mssql': {
                const sql = await Promise.resolve().then(() => __importStar(require('mssql')));
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
                const Database = (await Promise.resolve().then(() => __importStar(require('better-sqlite3')))).default;
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
    }
    catch (error) {
        logger_1.logger.error(`SQL execution error:`, error);
        throw error;
    }
}
//# sourceMappingURL=sql-adapter.js.map