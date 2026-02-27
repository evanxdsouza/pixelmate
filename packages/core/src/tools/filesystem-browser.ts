/**
 * Origin Private File System (OPFS) implementation for temporary files
 * Uses the File System Access API to provide isolated, fast storage
 */

export class OPFSFileSystem {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.rootHandle = await navigator.storage.getDirectory();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize OPFS:', error);
      throw new Error('OPFS not available in this browser');
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async readFile(path: string): Promise<string> {
    await this.ensureInitialized();
    const fileHandle = await this.getFileHandle(path);
    const file = await fileHandle.getFile();
    return await file.text();
  }

  async readFileAsBlob(path: string): Promise<Blob> {
    await this.ensureInitialized();
    const fileHandle = await this.getFileHandle(path);
    const file = await fileHandle.getFile();
    return file;
  }

  async writeFile(path: string, content: string | ArrayBuffer | Blob): Promise<void> {
    await this.ensureInitialized();
    const fileHandle = await this.getFileHandle(path, true);
    const writable = await fileHandle.createWritable();
    
    try {
      if (typeof content === 'string') {
        await writable.write(content);
      } else if (content instanceof ArrayBuffer) {
        await writable.write(new Uint8Array(content));
      } else if (content instanceof Blob) {
        await writable.write(content);
      }
    } finally {
      await writable.close();
    }
  }

  async deleteFile(path: string): Promise<void> {
    await this.ensureInitialized();
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return;

    let current = this.rootHandle!;
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i]);
    }

    await current.removeEntry(parts[parts.length - 1]);
  }

  async listFiles(directory: string = '/'): Promise<string[]> {
    await this.ensureInitialized();
    const dirHandle = await this.getDirHandle(directory);
    const files: string[] = [];

    for await (const entry of dirHandle.values()) {
      files.push(entry.name);
    }

    return files;
  }

  async createDirectory(path: string): Promise<void> {
    await this.ensureInitialized();
    const parts = path.split('/').filter(Boolean);
    let current = this.rootHandle!;

    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
  }

  async moveFile(from: string, to: string): Promise<void> {
    await this.ensureInitialized();
    const content = await this.readFileAsBlob(from);
    await this.writeFile(to, content);
    await this.deleteFile(from);
  }

  async copyFile(from: string, to: string): Promise<void> {
    await this.ensureInitialized();
    const content = await this.readFileAsBlob(from);
    await this.writeFile(to, content);
  }

  private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) throw new Error('Invalid file path');

    let current = this.rootHandle!;
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i], { create });
    }

    return await current.getFileHandle(parts[parts.length - 1], { create });
  }

  private async getDirHandle(path: string): Promise<FileSystemDirectoryHandle> {
    const parts = path.split('/').filter(Boolean);
    let current = this.rootHandle!;

    for (const part of parts) {
      current = await current.getDirectoryHandle(part);
    }

    return current;
  }
}

/**
 * Chrome File System Access API wrapper for user's file system
 */
export class ChromeFileSystemAccessor {
  private rootHandle: FileSystemDirectoryHandle | null = null;

  async requestAccess(): Promise<void> {
    try {
      this.rootHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        throw new Error('User denied file system access');
      }
      throw error;
    }
  }

  async readFile(path: string): Promise<string> {
    if (!this.rootHandle) throw new Error('File system access not granted');
    const fileHandle = await this.getFileHandle(path);
    const file = await fileHandle.getFile();
    return await file.text();
  }

  async readFileAsBlob(path: string): Promise<Blob> {
    if (!this.rootHandle) throw new Error('File system access not granted');
    const fileHandle = await this.getFileHandle(path);
    const file = await fileHandle.getFile();
    return file;
  }

  async writeFile(path: string, content: string | ArrayBuffer | Blob): Promise<void> {
    if (!this.rootHandle) throw new Error('File system access not granted');
    const fileHandle = await this.getFileHandle(path, true);
    const writable = await fileHandle.createWritable();

    try {
      if (typeof content === 'string') {
        await writable.write(content);
      } else if (content instanceof ArrayBuffer) {
        await writable.write(new Uint8Array(content));
      } else if (content instanceof Blob) {
        await writable.write(content);
      }
    } finally {
      await writable.close();
    }
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.rootHandle) throw new Error('File system access not granted');
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return;

    let current = this.rootHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      try {
        current = await current.getDirectoryHandle(parts[i]);
      } catch {
        return; // Path doesn't exist
      }
    }

    try {
      await current.removeEntry(parts[parts.length - 1]);
    } catch {
      // File doesn't exist
    }
  }

  async listFiles(directory: string = ''): Promise<string[]> {
    if (!this.rootHandle) throw new Error('File system access not granted');
    const dirHandle = await this.getDirHandle(directory);
    const files: string[] = [];

    for await (const entry of dirHandle.values()) {
      files.push(entry.name);
    }

    return files;
  }

  async createDirectory(path: string): Promise<void> {
    if (!this.rootHandle) throw new Error('File system access not granted');
    const parts = path.split('/').filter(Boolean);
    let current = this.rootHandle;

    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
  }

  async moveFile(from: string, to: string): Promise<void> {
    if (!this.rootHandle) throw new Error('File system access not granted');
    const content = await this.readFileAsBlob(from);
    await this.writeFile(to, content);
    await this.deleteFile(from);
  }

  async copyFile(from: string, to: string): Promise<void> {
    if (!this.rootHandle) throw new Error('File system access not granted');
    const content = await this.readFileAsBlob(from);
    await this.writeFile(to, content);
  }

  private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
    if (!this.rootHandle) throw new Error('File system access not granted');
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) throw new Error('Invalid file path');

    let current = this.rootHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i], { create });
    }

    return await current.getFileHandle(parts[parts.length - 1], { create });
  }

  private async getDirHandle(path: string): Promise<FileSystemDirectoryHandle> {
    if (!this.rootHandle) throw new Error('File system access not granted');
    const parts = path.split('/').filter(Boolean);
    let current = this.rootHandle;

    for (const part of parts) {
      try {
        current = await current.getDirectoryHandle(part);
      } catch {
        throw new Error(`Directory not found: ${path}`);
      }
    }

    return current;
  }

  hasAccess(): boolean {
    return this.rootHandle !== null;
  }
}
