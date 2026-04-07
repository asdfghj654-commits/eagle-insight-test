/**
 * File System Adapter
 * Supports local filesystem and network shares
 */

import fs from 'fs';
import path from 'path';
import { parse as csvParse } from 'csv-parse/sync';
import { logger } from '../utils/logger';

interface FileSystemConfig {
  basePath: string;
  protocol: 'local' | 'nfs' | 'smb';
}

interface DirectoryListOptions {
  path: string;
  recursive?: boolean;
  fileTypes?: string[];
  includeMetadata?: boolean;
}

interface FileReadOptions {
  path: string;
  format?: 'csv' | 'json' | 'parquet' | 'auto';
  encoding?: BufferEncoding;
  headers?: boolean;
  delimiter?: string;
  limit?: number;
}

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  extension?: string;
}

interface DirectoryListResult {
  success: boolean;
  data?: FileInfo[];
  currentPath: string;
  parentPath?: string;
  error?: string;
}

interface FileReadResult {
  success: boolean;
  data?: any[];
  metadata?: {
    rowCount: number;
    columns: string[];
    format: string;
    size?: number;
  };
  error?: string;
}

// In-memory storage for source configs
const sourceConfigs = new Map<string, FileSystemConfig>();

export function registerFileSystemSource(sourceId: string, config: FileSystemConfig): void {
  sourceConfigs.set(sourceId, config);
}

export async function testFileSystemConnection(config: FileSystemConfig): Promise<{ success: boolean; message: string }> {
  try {
    const fullPath = config.basePath;
    
    if (!fs.existsSync(fullPath)) {
      return { success: false, message: `Path does not exist: ${fullPath}` };
    }
    
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return { success: false, message: `Path is not a directory: ${fullPath}` };
    }
    
    // Try to read the directory
    fs.readdirSync(fullPath);
    
    return { success: true, message: `Successfully accessed: ${fullPath}` };
  } catch (error) {
    logger.error('File system connection test failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

export async function listDirectory(sourceId: string, options: DirectoryListOptions): Promise<DirectoryListResult> {
  const config = sourceConfigs.get(sourceId);
  
  if (!config) {
    return {
      success: false,
      currentPath: options.path,
      error: `File system source not found: ${sourceId}`,
    };
  }
  
  try {
    const fullPath = path.join(config.basePath, options.path);
    
    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        currentPath: options.path,
        error: `Path does not exist: ${options.path}`,
      };
    }
    
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const files: FileInfo[] = [];
    
    for (const entry of entries) {
      const entryPath = path.join(options.path, entry.name);
      const fullEntryPath = path.join(fullPath, entry.name);
      
      // Filter by file types if specified
      if (options.fileTypes && entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase().replace('.', '');
        if (!options.fileTypes.includes(ext) && !options.fileTypes.includes(`*.${ext}`)) {
          continue;
        }
      }
      
      const fileInfo: FileInfo = {
        name: entry.name,
        path: entryPath,
        type: entry.isDirectory() ? 'directory' : 'file',
        extension: entry.isFile() ? path.extname(entry.name).toLowerCase().replace('.', '') : undefined,
      };
      
      if (options.includeMetadata && entry.isFile()) {
        try {
          const stats = fs.statSync(fullEntryPath);
          fileInfo.size = stats.size;
          fileInfo.modifiedAt = stats.mtime.toISOString();
        } catch (e) {
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
      ? path.dirname(options.path) 
      : undefined;
    
    return {
      success: true,
      data: files,
      currentPath: options.path,
      parentPath,
    };
  } catch (error) {
    logger.error(`Directory listing error:`, error);
    return {
      success: false,
      currentPath: options.path,
      error: error instanceof Error ? error.message : 'Directory listing failed',
    };
  }
}

export async function readFile(sourceId: string, options: FileReadOptions): Promise<FileReadResult> {
  const config = sourceConfigs.get(sourceId);
  
  if (!config) {
    return { success: false, error: `File system source not found: ${sourceId}` };
  }
  
  try {
    const fullPath = path.join(config.basePath, options.path);
    
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `File does not exist: ${options.path}` };
    }
    
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      return { success: false, error: `Path is a directory, not a file: ${options.path}` };
    }
    
    // Determine format
    let format = options.format || 'auto';
    if (format === 'auto') {
      const ext = path.extname(fullPath).toLowerCase();
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
    
    const content = fs.readFileSync(fullPath, options.encoding || 'utf-8');
    let data: any[] = [];
    let columns: string[] = [];
    
    switch (format) {
      case 'csv': {
        const records = csvParse(content, {
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
  } catch (error) {
    logger.error(`File read error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'File read failed',
    };
  }
}
