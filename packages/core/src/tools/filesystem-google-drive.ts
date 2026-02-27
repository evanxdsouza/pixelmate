/**
 * Google Drive integration for file storage
 * Uses Google Drive API v3
 */

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
}

export class GoogleDriveFileSystem {
  private accessToken: string | null = null;
  private baseUrl = 'https://www.googleapis.com/drive/v3';

  async authenticate(accessToken: string): Promise<void> {
    this.accessToken = accessToken;
    // Verify token is valid by making a quick API call
    await this.listFiles('/');
  }

  async readFile(fileId: string): Promise<string> {
    if (!this.accessToken) throw new Error('Not authenticated with Google Drive');

    const response = await fetch(
      `${this.baseUrl}/files/${fileId}?alt=media`,
      {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      }
    );

    if (!response.ok) throw new Error(`Failed to read file: ${response.statusText}`);
    return await response.text();
  }

  async readFileAsBlob(fileId: string): Promise<Blob> {
    if (!this.accessToken) throw new Error('Not authenticated with Google Drive');

    const response = await fetch(
      `${this.baseUrl}/files/${fileId}?alt=media`,
      {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      }
    );

    if (!response.ok) throw new Error(`Failed to read file: ${response.statusText}`);
    return await response.blob();
  }

  async writeFile(fileName: string, content: string | Blob, parentId?: string): Promise<string> {
    if (!this.accessToken) throw new Error('Not authenticated with Google Drive');

    const metadata = {
      name: fileName,
      ...(parentId && { parents: [parentId] })
    };

    const formData = new FormData();
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );

    if (typeof content === 'string') {
      formData.append('file', new Blob([content], { type: 'text/plain' }));
    } else {
      formData.append('file', content);
    }

    const response = await fetch(
      `${this.baseUrl}/files?uploadType=multipart&fields=id`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
        body: formData
      }
    );

    if (!response.ok) throw new Error(`Failed to write file: ${response.statusText}`);
    const result = await response.json() as { id: string };
    return result.id;
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.accessToken) throw new Error('Not authenticated with Google Drive');

    const response = await fetch(
      `${this.baseUrl}/files/${fileId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      }
    );

    if (!response.ok) throw new Error(`Failed to delete file: ${response.statusText}`);
  }

  async listFiles(parentId: string): Promise<GoogleDriveFile[]> {
    if (!this.accessToken) throw new Error('Not authenticated with Google Drive');

    const query = parentId === '/' 
      ? `trashed=false`
      : `'${parentId}' in parents and trashed=false`;

    const response = await fetch(
      `${this.baseUrl}/files?q=${encodeURIComponent(query)}&pageSize=100&fields=files(id,name,mimeType,size,createdTime,modifiedTime)`,
      {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      }
    );

    if (!response.ok) throw new Error(`Failed to list files: ${response.statusText}`);
    const result = await response.json() as { files: GoogleDriveFile[] };
    return result.files;
  }

  async createDirectory(name: string, parentId?: string): Promise<string> {
    if (!this.accessToken) throw new Error('Not authenticated with Google Drive');

    const metadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId && { parents: [parentId] })
    };

    const response = await fetch(
      `${this.baseUrl}/files?fields=id`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      }
    );

    if (!response.ok) throw new Error(`Failed to create directory: ${response.statusText}`);
    const result = await response.json() as { id: string };
    return result.id;
  }

  async moveFile(fileId: string, newParentId: string): Promise<void> {
    if (!this.accessToken) throw new Error('Not authenticated with Google Drive');

    const response = await fetch(
      `${this.baseUrl}/files/${fileId}?addParents=${encodeURIComponent(newParentId)}&fields=id`,
      {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      }
    );

    if (!response.ok) throw new Error(`Failed to move file: ${response.statusText}`);
  }

  async copyFile(fileId: string, newName: string, parentId?: string): Promise<string> {
    if (!this.accessToken) throw new Error('Not authenticated with Google Drive');

    const metadata = {
      name: newName,
      ...(parentId && { parents: [parentId] })
    };

    const response = await fetch(
      `${this.baseUrl}/files/${fileId}/copy?fields=id`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      }
    );

    if (!response.ok) throw new Error(`Failed to copy file: ${response.statusText}`);
    const result = await response.json() as { id: string };
    return result.id;
  }

  hasAuth(): boolean {
    return this.accessToken !== null;
  }
}
