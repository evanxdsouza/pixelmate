/**
 * Hybrid filesystem that uses OPFS for temp files and Google Drive for persistence
 */

import { Tool, ToolDefinition, ToolResult } from '@pixelmate/shared';
import { OPFSFileSystem, ChromeFileSystemAccessor } from './filesystem-browser.js';
import { GoogleDriveFileSystem } from './filesystem-google-drive.js';

type FilesystemMode = 'opfs' | 'native' | 'google-drive';

export class HybridFileSystem {
  private opfs = new OPFSFileSystem();
  private chromeAccess = new ChromeFileSystemAccessor();
  private googleDrive: GoogleDriveFileSystem | null = null;
  private defaultMode: FilesystemMode = 'opfs';

  async initializeOPFS(): Promise<void> {
    try {
      await this.opfs.initialize();
    } catch (error) {
      console.error('OPFS initialization failed:', error);
    }
  }

  async requestNativeAccess(): Promise<void> {
    try {
      await this.chromeAccess.requestAccess();
      this.defaultMode = 'native';
    } catch (error) {
      console.error('Native file system access denied:', error);
    }
  }

  async initializeGoogleDrive(accessToken: string): Promise<void> {
    try {
      this.googleDrive = new GoogleDriveFileSystem();
      await this.googleDrive.authenticate(accessToken);
      this.defaultMode = 'google-drive';
    } catch (error) {
      console.error('Google Drive authentication failed:', error);
    }
  }

  async readFile(path: string, mode?: FilesystemMode): Promise<string> {
    const targetMode = mode || this.defaultMode;
    
    switch (targetMode) {
      case 'opfs':
        return await this.opfs.readFile(path);
      case 'native':
        return await this.chromeAccess.readFile(path);
      case 'google-drive':
        if (!this.googleDrive) throw new Error('Google Drive not initialized');
        return await this.googleDrive.readFile(path);
      default:
        throw new Error(`Unknown filesystem mode: ${targetMode}`);
    }
  }

  async writeFile(path: string, content: string | ArrayBuffer | Blob, mode?: FilesystemMode): Promise<void> {
    const targetMode = mode || this.defaultMode;
    
    switch (targetMode) {
      case 'opfs':
        return await this.opfs.writeFile(path, content);
      case 'native':
        return await this.chromeAccess.writeFile(path, content);
      case 'google-drive':
        if (!this.googleDrive) throw new Error('Google Drive not initialized');
        if (content instanceof ArrayBuffer) {
          await this.googleDrive.writeFile(path, new Blob([content]));
          return;
        }
        await this.googleDrive.writeFile(path, content);
        return;
      default:
        throw new Error(`Unknown filesystem mode: ${targetMode}`);
    }
  }

  async deleteFile(path: string, mode?: FilesystemMode): Promise<void> {
    const targetMode = mode || this.defaultMode;
    
    switch (targetMode) {
      case 'opfs':
        return await this.opfs.deleteFile(path);
      case 'native':
        return await this.chromeAccess.deleteFile(path);
      case 'google-drive':
        if (!this.googleDrive) throw new Error('Google Drive not initialized');
        return await this.googleDrive.deleteFile(path);
      default:
        throw new Error(`Unknown filesystem mode: ${targetMode}`);
    }
  }

  async listFiles(directory?: string, mode?: FilesystemMode): Promise<string[]> {
    const targetMode = mode || this.defaultMode;
    const dir = directory || '/';
    
    switch (targetMode) {
      case 'opfs':
        return await this.opfs.listFiles(dir);
      case 'native':
        return await this.chromeAccess.listFiles(dir);
      case 'google-drive':
        if (!this.googleDrive) throw new Error('Google Drive not initialized');
        const files = await this.googleDrive.listFiles(dir);
        return files.map(f => f.name);
      default:
        throw new Error(`Unknown filesystem mode: ${targetMode}`);
    }
  }

  async createDirectory(path: string, mode?: FilesystemMode): Promise<void> {
    const targetMode = mode || this.defaultMode;
    
    switch (targetMode) {
      case 'opfs':
        return await this.opfs.createDirectory(path);
      case 'native':
        return await this.chromeAccess.createDirectory(path);
      case 'google-drive':
        if (!this.googleDrive) throw new Error('Google Drive not initialized');
        await this.googleDrive.createDirectory(path);
        return;
      default:
        throw new Error(`Unknown filesystem mode: ${targetMode}`);
    }
  }

  async moveFile(from: string, to: string, mode?: FilesystemMode): Promise<void> {
    const targetMode = mode || this.defaultMode;
    
    switch (targetMode) {
      case 'opfs':
        return await this.opfs.moveFile(from, to);
      case 'native':
        return await this.chromeAccess.moveFile(from, to);
      case 'google-drive':
        if (!this.googleDrive) throw new Error('Google Drive not initialized');
        return await this.googleDrive.moveFile(from, to);
      default:
        throw new Error(`Unknown filesystem mode: ${targetMode}`);
    }
  }

  async copyFile(from: string, to: string, mode?: FilesystemMode): Promise<void> {
    const targetMode = mode || this.defaultMode;
    
    switch (targetMode) {
      case 'opfs':
        return await this.opfs.copyFile(from, to);
      case 'native':
        return await this.chromeAccess.copyFile(from, to);
      case 'google-drive':
        if (!this.googleDrive) throw new Error('Google Drive not initialized');
        await this.googleDrive.copyFile(from, to);
        return;
      default:
        throw new Error(`Unknown filesystem mode: ${targetMode}`);
    }
  }

  validatePath(path: string): boolean {
    // Reject empty paths
    if (!path || typeof path !== 'string') return false;
    // Reject null bytes (used to bypass extension checks on some platforms)
    if (path.includes('\0')) return false;
    // Reject URL-encoded traversal sequences
    const decoded = decodeURIComponent(path);
    if (decoded.includes('..')) return false;
    // Reject raw dot-dot sequences in the original string too
    if (path.includes('..')) return false;
    // Reject Windows-style absolute paths (e.g. C:\) that could escape OPFS sandbox
    if (/^[a-zA-Z]:[/\\]/.test(path)) return false;
    // Allow only absolute POSIX paths starting with /
    if (path.startsWith('/')) return true;
    return false;
  }
}

// Tool implementations for filesystem operations
export class ReadFileTool implements Tool {
  definition: ToolDefinition = {
    name: 'read_file',
    description: 'Read the contents of a file',
    parameters: [
      { name: 'path', description: 'Path to the file', type: 'string', required: true },
      { name: 'mode', description: 'Filesystem mode (opfs, native, google-drive)', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const path = params.path as string;
      const mode = params.mode as unknown as FilesystemMode | undefined;

      if (!this.fs.validatePath(path)) {
        return { success: false, error: 'Invalid file path' };
      }

      const content = await this.fs.readFile(path, mode);
      return { success: true, output: content };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class WriteFileTool implements Tool {
  definition: ToolDefinition = {
    name: 'write_file',
    description: 'Write content to a file',
    parameters: [
      { name: 'path', description: 'Path to the file', type: 'string', required: true },
      { name: 'content', description: 'Content to write', type: 'string', required: true },
      { name: 'mode', description: 'Filesystem mode (opfs, native, google-drive)', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const path = params.path as string;
      const content = params.content as string;
      const mode = params.mode as unknown as FilesystemMode | undefined;

      if (!this.fs.validatePath(path)) {
        return { success: false, error: 'Invalid file path' };
      }

      await this.fs.writeFile(path, content, mode);
      return { success: true, output: `File written to ${path}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class ListDirectoryTool implements Tool {
  definition: ToolDefinition = {
    name: 'list_directory',
    description: 'List files in a directory',
    parameters: [
      { name: 'path', description: 'Path to the directory', type: 'string', required: false },
      { name: 'mode', description: 'Filesystem mode (opfs, native, google-drive)', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const path = (params.path as string | undefined) || '/';
      const mode = params.mode as unknown as FilesystemMode | undefined;

      if (!this.fs.validatePath(path)) {
        return { success: false, error: 'Invalid directory path' };
      }

      const files = await this.fs.listFiles(path, mode);
      return { success: true, output: JSON.stringify(files) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class CreateDirectoryTool implements Tool {
  definition: ToolDefinition = {
    name: 'create_directory',
    description: 'Create a new directory',
    parameters: [
      { name: 'path', description: 'Path to the new directory', type: 'string', required: true },
      { name: 'mode', description: 'Filesystem mode (opfs, native, google-drive)', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const path = params.path as string;
      const mode = params.mode as unknown as FilesystemMode | undefined;

      if (!this.fs.validatePath(path)) {
        return { success: false, error: 'Invalid directory path' };
      }

      await this.fs.createDirectory(path, mode);
      return { success: true, output: `Directory created at ${path}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class DeleteFileTool implements Tool {
  definition: ToolDefinition = {
    name: 'delete_file',
    description: 'Delete a file',
    parameters: [
      { name: 'path', description: 'Path to the file to delete', type: 'string', required: true },
      { name: 'mode', description: 'Filesystem mode (opfs, native, google-drive)', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const path = params.path as string;
      const mode = params.mode as unknown as FilesystemMode | undefined;

      if (!this.fs.validatePath(path)) {
        return { success: false, error: 'Invalid file path' };
      }

      await this.fs.deleteFile(path, mode);
      return { success: true, output: `File deleted: ${path}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class MoveFileTool implements Tool {
  definition: ToolDefinition = {
    name: 'move_file',
    description: 'Move a file to a new location',
    parameters: [
      { name: 'from', description: 'Source path', type: 'string', required: true },
      { name: 'to', description: 'Destination path', type: 'string', required: true },
      { name: 'mode', description: 'Filesystem mode (opfs, native, google-drive)', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const from = params.from as string;
      const to = params.to as string;
      const mode = params.mode as unknown as FilesystemMode | undefined;

      if (!this.fs.validatePath(from) || !this.fs.validatePath(to)) {
        return { success: false, error: 'Invalid file path' };
      }

      await this.fs.moveFile(from, to, mode);
      return { success: true, output: `File moved from ${from} to ${to}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class CopyFileTool implements Tool {
  definition: ToolDefinition = {
    name: 'copy_file',
    description: 'Copy a file to a new location',
    parameters: [
      { name: 'from', description: 'Source path', type: 'string', required: true },
      { name: 'to', description: 'Destination path', type: 'string', required: true },
      { name: 'mode', description: 'Filesystem mode (opfs, native, google-drive)', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const from = params.from as string;
      const to = params.to as string;
      const mode = params.mode as unknown as FilesystemMode | undefined;

      if (!this.fs.validatePath(from) || !this.fs.validatePath(to)) {
        return { success: false, error: 'Invalid file path' };
      }

      await this.fs.copyFile(from, to, mode);
      return { success: true, output: `File copied from ${from} to ${to}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
