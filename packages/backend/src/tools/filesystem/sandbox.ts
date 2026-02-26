import path from 'path';

export class PathSandbox {
  private workingDirectory: string;

  constructor(workingDirectory: string) {
    this.workingDirectory = path.resolve(workingDirectory);
  }

  resolve(relativePath: string): string {
    const resolved = path.resolve(this.workingDirectory, relativePath);
    
    // Ensure the resolved path is within the working directory
    if (!resolved.startsWith(this.workingDirectory)) {
      throw new Error(`Access denied: Path "${relativePath}" is outside the working directory`);
    }
    
    return resolved;
  }

  getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  isWithinSandbox(absolutePath: string): boolean {
    const resolved = path.resolve(absolutePath);
    return resolved.startsWith(this.workingDirectory);
  }
}
