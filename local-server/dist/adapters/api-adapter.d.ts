/**
 * External API Adapter
 * Proxy for calling internal/external APIs
 */
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
export declare function registerAPISource(sourceId: string, config: APIConfig): void;
export declare function testAPIConnection(config: APIConfig): Promise<{
    success: boolean;
    message: string;
}>;
export declare function callExternalAPI(sourceId: string, options: APIRequestOptions): Promise<APIResult>;
export {};
//# sourceMappingURL=api-adapter.d.ts.map