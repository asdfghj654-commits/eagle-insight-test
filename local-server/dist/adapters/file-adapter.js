"use strict";
/**
 * File System Adapter
 * Supports local filesystem and network shares
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFileSystemSource = registerFileSystemSource;
exports.testFileSystemConnection = testFileSystemConnection;
exports.listDirectory = listDirectory;
exports.readFile = readFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sync_1 = require("csv-parse/sync");
const logger_1 = require("../utils/logger");
// In-memory storage for source configs
const sourceConfigs = new Map();
function registerFileSystemSource(sourceId, config) {
    sourceConfigs.set(sourceId, config);
}
async function testFileSystemConnection(config) {
    try {
        const fullPath = config.basePath;
        if (!fs_1.default.existsSync(fullPath)) {
            return { success: false, message: `Path does not exist: ${fullPath}` };
        }
        const stats = fs_1.default.statSync(fullPath);
        if (!stats.isDirectory()) {
            return { success: false, message: `Path is not a directory: ${fullPath}` };
        }
        // Try to read the directory
        fs_1.default.readdirSync(fullPath);
        return { success: true, message: `Successfully accessed: ${fullPath}` };
    }
    catch (error) {
        logger_1.logger.error('File system connection test failed:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Connection failed',
        };
    }
}
async function listDirectory(sourceId, options) {
    const config = sourceConfigs.get(sourceId);
    if (!config) {
        return {
            success: false,
            currentPath: options.path,
            error: `File system source not found: ${sourceId}`,
        };
    }
    try {
        const fullPath = path_1.default.join(config.basePath, options.path);
        if (!fs_1.default.existsSync(fullPath)) {
            return {
                success: false,
                currentPath: options.path,
                error: `Path does not exist: ${options.path}`,
            };
        }
        const entries = fs_1.default.readdirSync(fullPath, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            const entryPath = path_1.default.join(options.path, entry.name);
            const fullEntryPath = path_1.default.join(fullPath, entry.name);
            // Filter by file types if specified
            if (options.fileTypes && entry.isFile()) {
                const ext = path_1.default.extname(entry.name).toLowerCase().replace('.', '');
                if (!options.fileTypes.includes(ext) && !options.fileTypes.includes(`*.${ext}`)) {
                    continue;
                }
            }
            const fileInfo = {
                name: entry.name,
                path: entryPath,
                type: entry.isDirectory() ? 'directory' : 'file',
                extension: entry.isFile() ? path_1.default.extname(entry.name).toLowerCase().replace('.', '') : undefined,
            };
            if (options.includeMetadata && entry.isFile()) {
                try {
                    const stats = fs_1.default.statSync(fullEntryPath);
                    fileInfo.size = stats.size;
                    fileInfo.modifiedAt = stats.mtime.toISOString();
                }
                catch (e) {
                    // Ignore stat errors
                }
            }
            files.push(fileInfo);
            // Handle recursive listing
            if (options.recursive && entry.isDirectory()) {
                const subResult = await listDirectory(sourceId, {
                    ...options,
                    path: entryPath,
                });
                if (subResult.success && subResult.data) {
                    files.push(...subResult.data);
                }
            }
        }
        // Sort: directories first, then files, alphabetically
        files.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        const parentPath = options.path !== '/' && options.path !== ''
            ? path_1.default.dirname(options.path)
            : undefined;
        return {
            success: true,
            data: files,
            currentPath: options.path,
            parentPath,
        };
    }
    catch (error) {
        logger_1.logger.error(`Directory listing error:`, error);
        return {
            success: false,
            currentPath: options.path,
            error: error instanceof Error ? error.message : 'Directory listing failed',
        };
    }
}
async function readFile(sourceId, options) {
    const config = sourceConfigs.get(sourceId);
    if (!config) {
        return { success: false, error: `File system source not found: ${sourceId}` };
    }
    try {
        const fullPath = path_1.default.join(config.basePath, options.path);
        if (!fs_1.default.existsSync(fullPath)) {
            return { success: false, error: `File does not exist: ${options.path}` };
        }
        const stats = fs_1.default.statSync(fullPath);
        if (stats.isDirectory()) {
            return { success: false, error: `Path is a directory, not a file: ${options.path}` };
        }
        // Determine format
        let format = options.format || 'auto';
        if (format === 'auto') {
            const ext = path_1.default.extname(fullPath).toLowerCase();
            switch (ext) {
                case '.csv':
                    format = 'csv';
                    break;
                case '.json':
                    format = 'json';
                    break;
                case '.parquet':
                    format = 'parquet';
                    break;
                default:
                    format = 'csv'; // Default to CSV
            }
        }
        const content = fs_1.default.readFileSync(fullPath, options.encoding || 'utf-8');
        let data = [];
        let columns = [];
        switch (format) {
            case 'csv': {
                const records = (0, sync_1.parse)(content, {
                    columns: options.headers !== false,
                    delimiter: options.delimiter || ',',
                    skip_empty_lines: true,
                    trim: true,
                });
                data = options.limit ? records.slice(0, options.limit) : records;
                columns = data.length > 0 ? Object.keys(data[0]) : [];
                break;
            }
            case 'json': {
                const parsed = JSON.parse(content);
                data = Array.isArray(parsed) ? parsed : [parsed];
                if (options.limit) {
                    data = data.slice(0, options.limit);
                }
                columns = data.length > 0 ? Object.keys(data[0]) : [];
                break;
            }
            case 'parquet': {
                // Parquet requires special handling - for now return error
                return { success: false, error: 'Parquet format not yet supported. Please convert to CSV or JSON.' };
            }
            default:
                return { success: false, error: `Unsupported format: ${format}` };
        }
        return {
            success: true,
            data,
            metadata: {
                rowCount: data.length,
                columns,
                format,
                size: stats.size,
            },
        };
    }
    catch (error) {
        logger_1.logger.error(`File read error:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'File read failed',
        };
    }
}
//# sourceMappingURL=file-adapter.js.map