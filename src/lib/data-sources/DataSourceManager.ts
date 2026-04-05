// DataSourceManager - Frontend client for Local Data Proxy Server

import {
  AnyDataSourceConfig,
  SQLDataSourceConfig,
  FileSystemDataSourceConfig,
  APIDataSourceConfig,
  SQLQueryOptions,
  FileReadOptions,
  DirectoryListOptions,
  APIRequestOptions,
  DataSourceResult,
  DirectoryListResult,
  ConnectionTestResult,
  FlightFilter,
  FlightDataRow,
  ProxyServerConfig,
  DEFAULT_PROXY_CONFIG,
  IDataSourceManager,
} from './types';

class DataSourceManager implements IDataSourceManager {
  private proxyConfig: ProxyServerConfig;
  private dataSources: Map<string, AnyDataSourceConfig> = new Map();
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(config?: Partial<ProxyServerConfig>) {
    this.proxyConfig = { ...DEFAULT_PROXY_CONFIG, ...config };
    this.loadFromStorage();
    this.syncFromServer().catch((error) => {
      console.warn('Failed to sync data sources from local server:', error);
    });
  }

  private get baseUrl(): string {
    return `http://${this.proxyConfig.host}:${this.proxyConfig.port}`;
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.proxyConfig.apiKey) {
      headers['X-API-Key'] = this.proxyConfig.apiKey;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `Request failed: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error(`Cannot connect to local proxy server at ${this.baseUrl}. Make sure the server is running.`);
      }
      throw error;
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('dataSources');
      if (saved) {
        const sources: AnyDataSourceConfig[] = JSON.parse(saved);
        sources.forEach(source => this.dataSources.set(source.id, source));
      }
    } catch (error) {
      console.error('Failed to load data sources from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const sources = Array.from(this.dataSources.values());
      localStorage.setItem('dataSources', JSON.stringify(sources));
    } catch (error) {
      console.error('Failed to save data sources to storage:', error);
    }
  }

  private async syncFromServer(): Promise<void> {
    try {
      const response = await this.request<{ success: boolean; data: AnyDataSourceConfig[] }>('/api/sources');
      if (response.success && Array.isArray(response.data)) {
        this.dataSources.clear();
        response.data.forEach(source => this.dataSources.set(source.id, source));
        this.saveToStorage();
      }
    } catch (error) {
      console.warn('Source sync unavailable; retaining local cache');
    }
  }

  private getCacheKey(sourceId: string, operation: string, params: any): string {
    return `${sourceId}:${operation}:${JSON.stringify(params)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Configuration Methods
  async addDataSource(config: AnyDataSourceConfig): Promise<void> {
    config.createdAt = new Date().toISOString();
    config.updatedAt = new Date().toISOString();
    this.dataSources.set(config.id, config);
    this.saveToStorage();
    
    // Register with proxy server
    await this.request('/api/sources', 'POST', config);
    await this.syncFromServer();
  }

  async removeDataSource(id: string): Promise<void> {
    this.dataSources.delete(id);
    this.saveToStorage();
    
    // Remove from proxy server
    await this.request(`/api/sources/${id}`, 'DELETE');
    await this.syncFromServer();
  }

  async updateDataSource(id: string, updates: Partial<AnyDataSourceConfig>): Promise<void> {
    const existing = this.dataSources.get(id);
    if (existing) {
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      this.dataSources.set(id, updated as AnyDataSourceConfig);
      this.saveToStorage();
      
      // Update on proxy server
      await this.request(`/api/sources/${id}`, 'PUT', updated);
      await this.syncFromServer();
    }
  }

  getDataSources(): AnyDataSourceConfig[] {
    return Array.from(this.dataSources.values());
  }

  getDataSource(id: string): AnyDataSourceConfig | undefined {
    return this.dataSources.get(id);
  }

  // Connection Testing
  async testConnection(id: string): Promise<ConnectionTestResult> {
    const source = this.dataSources.get(id);
    if (!source) {
      return { success: false, message: 'Data source not found' };
    }

    try {
      const startTime = Date.now();
      const result = await this.request<ConnectionTestResult>(`/api/sources/${id}/test`, 'POST');
      result.latency = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  // SQL Operations
  async executeQuery(sourceId: string, options: SQLQueryOptions): Promise<DataSourceResult> {
    const cacheKey = this.getCacheKey(sourceId, 'query', options);
    const cached = this.getFromCache<DataSourceResult>(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.request<DataSourceResult>(`/api/sql/${sourceId}/query`, 'POST', options);
      if (result.success) {
        this.setCache(cacheKey, result);
      }
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query execution failed',
      };
    }
  }

  // File System Operations
  async listDirectory(sourceId: string, options: DirectoryListOptions): Promise<DirectoryListResult> {
    const cacheKey = this.getCacheKey(sourceId, 'listDir', options);
    const cached = this.getFromCache<DirectoryListResult>(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.request<DirectoryListResult>(`/api/files/${sourceId}/list`, 'POST', options);
      if (result.success) {
        this.setCache(cacheKey, result);
      }
      return result;
    } catch (error) {
      return {
        success: false,
        currentPath: options.path,
        error: error instanceof Error ? error.message : 'Directory listing failed',
      };
    }
  }

  async readFile(sourceId: string, options: FileReadOptions): Promise<DataSourceResult> {
    try {
      const result = await this.request<DataSourceResult>(`/api/files/${sourceId}/read`, 'POST', options);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'File read failed',
      };
    }
  }

  // API Operations
  async callAPI(sourceId: string, options: APIRequestOptions): Promise<DataSourceResult> {
    try {
      const result = await this.request<DataSourceResult>(`/api/proxy/${sourceId}`, 'POST', options);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API call failed',
      };
    }
  }

  // Flight Data Operations
  async loadFlightData(sourceId: string, filters?: FlightFilter): Promise<DataSourceResult<FlightDataRow[]>> {
    const source = this.dataSources.get(sourceId);
    if (!source) {
      return { success: false, error: 'Data source not found' };
    }

    try {
      const result = await this.request<DataSourceResult<FlightDataRow[]>>(
        `/api/flights/${sourceId}`,
        'POST',
        { filters }
      );
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load flight data',
      };
    }
  }

  // Check if proxy server is available
  async checkProxyHealth(): Promise<boolean> {
    try {
      const result = await this.request<{ status: string }>('/api/health');
      return result.status === 'ok';
    } catch {
      return false;
    }
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Update proxy configuration
  setProxyConfig(config: Partial<ProxyServerConfig>): void {
    this.proxyConfig = { ...this.proxyConfig, ...config };
  }
}

// Singleton instance
export const dataSourceManager = new DataSourceManager();

export default DataSourceManager;
