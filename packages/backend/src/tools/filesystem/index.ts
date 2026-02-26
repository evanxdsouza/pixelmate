import fs from 'fs/promises';
import path from 'path';
import { Tool, ToolResult, ToolParameter } from '../types.js';
import { PathSandbox } from './sandbox.js';

type ParamType = 'string' | 'number' | 'boolean' | 'object' | 'array';

function param(name: string, description: string, type: ParamType, required: boolean, defaultValue?: unknown): ToolParameter {
  return { name, description, type, required, default: defaultValue };
}

export class ReadFileTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'read_file',
    description: 'Read the contents of a file from the filesystem',
    parameters: [
      param('path', 'The path to the file to read (relative to working directory)', 'string', true)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = this.sandbox.resolve(params.path as string);
      
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return { success: false, error: 'Not a file' };
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, output: content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class WriteFileTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it does not exist, overwrites if it does.',
    parameters: [
      param('path', 'The path to the file to write (relative to working directory)', 'string', true),
      param('content', 'The content to write to the file', 'string', true)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = this.sandbox.resolve(params.path as string);
      
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(filePath, params.content as string, 'utf-8');
      return { success: true, output: `File written successfully: ${params.path}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class ListDirectoryTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'list_directory',
    description: 'List files and directories in a given directory',
    parameters: [
      param('path', 'The path to the directory to list (relative to working directory, or "." for root)', 'string', false, '.')
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const dirPath = this.sandbox.resolve((params.path as string) || '.');
      
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      const items = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(dirPath, entry.name);
          const stats = await fs.stat(fullPath);
          return {
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        })
      );
      
      return { 
        success: true, 
        output: JSON.stringify(items, null, 2) 
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class CreateDirectoryTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'create_directory',
    description: 'Create a new directory',
    parameters: [
      param('path', 'The path to the directory to create (relative to working directory)', 'string', true)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const dirPath = this.sandbox.resolve(params.path as string);
      await fs.mkdir(dirPath, { recursive: true });
      return { success: true, output: `Directory created: ${params.path}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class DeleteFileTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'delete_file',
    description: 'Delete a file or directory',
    parameters: [
      param('path', 'The path to the file or directory to delete (relative to working directory)', 'string', true)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const targetPath = this.sandbox.resolve(params.path as string);
      
      const stats = await fs.stat(targetPath);
      
      if (stats.isDirectory()) {
        await fs.rm(targetPath, { recursive: true });
      } else {
        await fs.unlink(targetPath);
      }
      
      return { success: true, output: `Deleted: ${params.path}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class MoveFileTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'move_file',
    description: 'Move or rename a file or directory',
    parameters: [
      param('source', 'The source path (relative to working directory)', 'string', true),
      param('destination', 'The destination path (relative to working directory)', 'string', true)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const sourcePath = this.sandbox.resolve(params.source as string);
      const destPath = this.sandbox.resolve(params.destination as string);
      
      await fs.rename(sourcePath, destPath);
      
      return { success: true, output: `Moved: ${params.source} -> ${params.destination}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class CopyFileTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'copy_file',
    description: 'Copy a file or directory',
    parameters: [
      param('source', 'The source path (relative to working directory)', 'string', true),
      param('destination', 'The destination path (relative to working directory)', 'string', true)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const sourcePath = this.sandbox.resolve(params.source as string);
      const destPath = this.sandbox.resolve(params.destination as string);
      
      const stats = await fs.stat(sourcePath);
      
      if (stats.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
      
      return { success: true, output: `Copied: ${params.source} -> ${params.destination}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

export class GlobTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'glob',
    description: 'Find files matching a pattern (supports wildcards like *.txt, **/*.js)',
    parameters: [
      param('pattern', 'The glob pattern to match', 'string', true),
      param('path', 'The directory to search in (relative to working directory)', 'string', false, '.')
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const pattern = params.pattern as string;
      const searchPath = this.sandbox.resolve((params.path as string) || '.');
      
      const matches = await this.glob(searchPath, pattern);
      
      return { success: true, output: JSON.stringify(matches, null, 2) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async glob(dir: string, pattern: string): Promise<string[]> {
    const results: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    const regex = this.patternToRegex(pattern);
    const parts = pattern.split('/');
    const isRecursive = pattern.includes('**');
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (isRecursive || parts[parts.length - 1] !== entry.name) {
          const subResults = await this.glob(fullPath, pattern);
          results.push(...subResults);
        }
      } else if (entry.isFile()) {
        if (regex.test(entry.name)) {
          results.push(path.relative(this.sandbox.getWorkingDirectory(), fullPath));
        }
      }
    }
    
    return results;
  }

  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }
}
