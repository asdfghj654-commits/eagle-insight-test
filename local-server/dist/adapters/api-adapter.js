"use strict";
/**
 * External API Adapter
 * Proxy for calling internal/external APIs
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAPISource = registerAPISource;
exports.testAPIConnection = testAPIConnection;
exports.callExternalAPI = callExternalAPI;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
// In-memory storage for source configs
const sourceConfigs = new Map();
function registerAPISource(sourceId, config) {
    sourceConfigs.set(sourceId, config);
}
async function testAPIConnection(config) {
    try {
        const startTime = Date.now();
        const axiosConfig = {
            url: config.baseUrl,
            method: 'GET',
            timeout: config.timeout || 10000,
            headers: { ...config.headers },
        };
        // Add authentication
        if (config.authType === 'bearer' && config.authToken) {
            axiosConfig.headers['Authorization'] = `Bearer ${config.authToken}`;
        }
        else if (config.authType === 'api-key' && config.authHeader && config.authToken) {
            axiosConfig.headers[config.authHeader] = config.authToken;
        }
        else if (config.authType === 'basic' && config.authToken) {
            axiosConfig.headers['Authorization'] = `Basic ${config.authToken}`;
        }
        const response = await (0, axios_1.default)(axiosConfig);
        const responseTime = Date.now() - startTime;
        return {
            success: true,
            message: `API connection successful (${response.status} in ${responseTime}ms)`,
        };
    }
    catch (error) {
        logger_1.logger.error('API connection test failed:', error);
        if (axios_1.default.isAxiosError(error)) {
            if (error.response) {
                return {
                    success: false,
                    message: `API returned error: ${error.response.status} ${error.response.statusText}`,
                };
            }
            else if (error.request) {
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
async function callExternalAPI(sourceId, options) {
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
        const axiosConfig = {
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
            axiosConfig.headers['Authorization'] = `Bearer ${config.authToken}`;
        }
        else if (config.authType === 'api-key' && config.authHeader && config.authToken) {
            axiosConfig.headers[config.authHeader] = config.authToken;
        }
        else if (config.authType === 'basic' && config.authToken) {
            axiosConfig.headers['Authorization'] = `Basic ${config.authToken}`;
        }
        logger_1.logger.info(`API call: ${options.method} ${url}`);
        const response = await (0, axios_1.default)(axiosConfig);
        const responseTime = Date.now() - startTime;
        return {
            success: true,
            data: response.data,
            metadata: {
                statusCode: response.status,
                responseTime,
                headers: response.headers,
            },
        };
    }
    catch (error) {
        logger_1.logger.error(`API call error:`, error);
        if (axios_1.default.isAxiosError(error)) {
            if (error.response) {
                return {
                    success: false,
                    data: error.response.data,
                    metadata: {
                        statusCode: error.response.status,
                        responseTime: 0,
                        headers: error.response.headers,
                    },
                    error: `API error: ${error.response.status} ${error.response.statusText}`,
                };
            }
            else if (error.request) {
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
//# sourceMappingURL=api-adapter.js.map