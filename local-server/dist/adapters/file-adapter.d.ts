/**
 * File System Adapter
 * Supports local filesystem and network shares
 */
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
export declare function registerFileSystemSource(sourceId: string, config: FileSystemConfig): void;
export declare function testFileSystemConnection(config: FileSystemConfig): Promise<{
    success: boolean;
    message: string;
}>;
export declare function listDirectory(sourceId: string, options: DirectoryListOptions): Promise<DirectoryListResult>;
export declare function readFile(sourceId: string, options: FileReadOptions): Promise<FileReadResult>;
export {};
//# sourceMappingURL=file-adapter.d.ts.map