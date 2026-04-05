/**
 * External API Adapter
 * Proxy for calling internal/external APIs
 */

import axios, { AxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';

interface APIConfig {
  baseUrl: string;
  authType: 'none' | 'bearer' | 'basic' | 'api-key';
  authHeader?: string;
  authToken?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

interface APIRequestOptions {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  queryParams?: Record<string, string>;
  headers?: Record<string, string>;
}

interface APIResult {
  success: boolean;
  data?: any;
  metadata?: {
    statusCode: number;
    responseTime: number;
    headers: Record<string, string>;
  };
  error?: string;
}

// In-memory storage for source configs
const sourceConfigs = new Map<string, APIConfig>();

export function registerAPISource(sourceId: string, config: APIConfig): void {
  sourceConfigs.set(sourceId, config);
}

export async function testAPIConnection(config: APIConfig): Promise<{ success: boolean; message: string }> {
  try {
    const startTime = Date.now();
    
    const axiosConfig: AxiosRequestConfig = {
      url: config.baseUrl,
      method: 'GET',
      timeout: config.timeout || 10000,
      headers: { ...config.headers },
    };
    
    // Add authentication
    if (config.authType === 'bearer' && config.authToken) {
      axiosConfig.headers!['Authorization'] = `Bearer ${config.authToken}`;
    } else if (config.authType === 'api-key' && config.authHeader && config.authToken) {
      axiosConfig.headers![config.authHeader] = config.authToken;
    } else if (config.authType === 'basic' && config.authToken) {
      axiosConfig.headers!['Authorization'] = `Basic ${config.authToken}`;
    }
    
    const response = await axios(axiosConfig);
    const responseTime = Date.now() - startTime;
    
    return {
      success: true,
      message: `API connection successful (${response.status} in ${responseTime}ms)`,
    };
  } catch (error) {
    logger.error('API connection test failed:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return {
          success: false,
          message: `API returned error: ${error.response.status} ${error.response.statusText}`,
        };
      } else if (error.request) {
        return {
          success: false,
          message: `Cannot reach API: ${error.message}`,
        };
      }
    }
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

export async function callExternalAPI(sourceId: string, options: APIRequestOptions): Promise<APIResult> {
  const config = sourceConfigs.get(sourceId);
  
  if (!config) {
    return { success: false, error: `API source not found: ${sourceId}` };
  }
  
  try {
    const startTime = Date.now();
    
    // Build URL
    let url = config.baseUrl;
    if (!url.endsWith('/') && !options.endpoint.startsWith('/')) {
      url += '/';
    }
    url += options.endpoint;
    
    // Build axios config
    const axiosConfig: AxiosRequestConfig = {
      url,
      method: options.method,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
        ...options.headers,
      },
      params: options.queryParams,
      data: options.body,
    };
    
    // Add authentication
    if (config.authType === 'bearer' && config.authToken) {
      axiosConfig.headers!['Authorization'] = `Bearer ${config.authToken}`;
    } else if (config.authType === 'api-key' && config.authHeader && config.authToken) {
      axiosConfig.headers![config.authHeader] = config.authToken;
    } else if (config.authType === 'basic' && config.authToken) {
      axiosConfig.headers!['Authorization'] = `Basic ${config.authToken}`;
    }
    
    logger.info(`API call: ${options.method} ${url}`);
    
    const response = await axios(axiosConfig);
    const responseTime = Date.now() - startTime;
    
    return {
      success: true,
      data: response.data,
      metadata: {
        statusCode: response.status,
        responseTime,
        headers: response.headers as Record<string, string>,
      },
    };
  } catch (error) {
    logger.error(`API call error:`, error);
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return {
          success: false,
          data: error.response.data,
          metadata: {
            statusCode: error.response.status,
            responseTime: 0,
            headers: error.response.headers as Record<string, string>,
          },
          error: `API error: ${error.response.status} ${error.response.statusText}`,
        };
      } else if (error.request) {
        return {
          success: false,
          error: `Cannot reach API: ${error.message}`,
        };
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'API call failed',
    };
  }
}
