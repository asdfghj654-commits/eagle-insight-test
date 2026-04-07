// Data Source Types & Interfaces for On-Premise Deployment

export type DataSourceType = 'sql' | 'filesystem' | 'api';
export type SQLDialect = 'postgresql' | 'mysql' | 'mssql' | 'oracle' | 'vertica' | 'sqlite';

// Base configuration for all data sources
export interface DataSourceConfig {
  id: string;
  name: string;
  type: DataSourceType;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// SQL Database Configuration
export interface SQLDataSourceConfig extends DataSourceConfig {
  type: 'sql';
  dialect: SQLDialect;
  connectionString: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  // Password should be stored securely, not in config
  ssl?: boolean;
  poolSize?: number;
}

// File System / NAS Configuration
export interface FileSystemDataSourceConfig extends DataSourceConfig {
  type: 'filesystem';
  basePath: string;
  protocol: 'local' | 'nfs' | 'smb' | 'ftp';
  credentials?: {
    username?: string;
    // Password should be stored securely
  };
  filePatterns?: string[]; // e.g., ['*.csv', '*.json', '*.parquet']
}

// API Configuration
export interface APIDataSourceConfig extends DataSourceConfig {
  type: 'api';
  baseUrl: string;
  authType: 'none' | 'bearer' | 'basic' | 'api-key';
  authHeader?: string;
  // Token/key should be stored securely
  headers?: Record<string, string>;
  timeout?: number;
}

export type AnyDataSourceConfig = SQLDataSourceConfig | FileSystemDataSourceConfig | APIDataSourceConfig;

// Query Options
export interface SQLQueryOptions {
  query: string;
  parameters?: Record<string, any>;
  limit?: number;
  offset?: number;
  timeout?: number;
}

export interface FileReadOptions {
  path: string;
  format?: 'csv' | 'json' | 'parquet' | 'auto';
  encoding?: string;
  headers?: boolean;
  delimiter?: string;
  limit?: number;
}

export interface DirectoryListOptions {
  path: string;
  recursive?: boolean;
  fileTypes?: string[];
  includeMetadata?: boolean;
}

export interface APIRequestOptions {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  queryParams?: Record<string, string>;
  headers?: Record<string, string>;
}

// Result Types
export interface DataSourceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    rowCount?: number;
    executionTime?: number;
    columns?: string[];
    sourceId?: string;
  };
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  extension?: string;
}

export interface DirectoryListResult extends DataSourceResult<FileInfo[]> {
  currentPath: string;
  parentPath?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
  details?: Record<string, any>;
}

// Flight Data Types (mapped from sources)
export interface FlightFilter {
  tailNumbers?: string[];
  dateRange?: { start: string; end: string };
  phases?: string[];
  squadrons?: string[];
  flightIds?: string[];
  parameters?: string[];
}

export interface FlightDataRow {
  flight_id: string;
  tail_number: string;
  timestamp: string;
  phase: string;
  [key: string]: any;
}

// Data Source Manager Interface
export interface IDataSourceManager {
  // Configuration
  addDataSource(config: AnyDataSourceConfig): Promise<void>;
  removeDataSource(id: string): Promise<void>;
  updateDataSource(id: string, config: Partial<AnyDataSourceConfig>): Promise<void>;
  getDataSources(): AnyDataSourceConfig[];
  
  // Connection
  testConnection(id: string): Promise<ConnectionTestResult>;
  
  // SQL Operations
  executeQuery(sourceId: string, options: SQLQueryOptions): Promise<DataSourceResult>;
  
  // File Operations
  listDirectory(sourceId: string, options: DirectoryListOptions): Promise<DirectoryListResult>;
  readFile(sourceId: string, options: FileReadOptions): Promise<DataSourceResult>;
  
  // API Operations
  callAPI(sourceId: string, options: APIRequestOptions): Promise<DataSourceResult>;
  
  // Flight Data Operations
  loadFlightData(sourceId: string, filters?: FlightFilter): Promise<DataSourceResult<FlightDataRow[]>>;
}

// Local Proxy Server Configuration
export interface ProxyServerConfig {
  host: string;
  port: number;
  apiKey?: string;
}

export const DEFAULT_PROXY_CONFIG: ProxyServerConfig = {
  host: 'localhost',
  port: 3001,
};
