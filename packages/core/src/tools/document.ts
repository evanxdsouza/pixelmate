/**
 * Document generation tools using DOCX library and Google Docs API
 * Browser-compatible implementation
 */

import { Tool, ToolDefinition, ToolResult } from '@pixelmate/shared';
import { HybridFileSystem } from './filesystem.js';

// Placeholder for docx import (would need proper bundling)
// For now, we'll create a simple implementation

export class CreateDocumentTool implements Tool {
  definition: ToolDefinition = {
    name: 'create_document',
    description: 'Create a new document with content',
    parameters: [
      { name: 'title', description: 'Document title', type: 'string', required: true },
      { name: 'content', description: 'Document content (markdown or text)', type: 'string', required: true },
      { name: 'filePath', description: 'Path to save document (optional)', type: 'string', required: false },
      { name: 'format', description: 'Output format: docx or google', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const title = params.title as string;
      const content = params.content as string;
      const filePath = (params.filePath as string) || `/${title}.docx`;
      const format = (params.format as string) || 'docx';

      if (format === 'google') {
        return { success: false, error: 'Use the google_docs_create tool to create a real Google Doc. Make sure you have signed in to Google in Settings first.' };
      }

      // Create simple DOCX-like document
      const docContent = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <title>${escapeXml(title)}</title>
  <body>
    ${escapeXml(content).split('\n').map(line => `<paragraph>${line}</paragraph>`).join('\n')}
  </body>
</document>`;

      await this.fs.writeFile(filePath, docContent);
      
      return { success: true, output: `Document created at ${filePath}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class ConvertToDocumentTool implements Tool {
  definition: ToolDefinition = {
    name: 'convert_to_document',
    description: 'Convert markdown or text to a document',
    parameters: [
      { name: 'title', description: 'Document title', type: 'string', required: true },
      { name: 'source', description: 'Source file path or content', type: 'string', required: true },
      { name: 'format', description: 'Output format: docx or google', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const title = params.title as string;
      const source = params.source as string;
      const format = (params.format as string) || 'docx';

      // Try to read source as file
      let content = source;
      try {
        content = await this.fs.readFile(source);
      } catch {
        // If not a file, use source as content directly
      }

      if (format === 'google') {
        return { success: false, error: 'Use the google_docs_create tool to create a real Google Doc. Make sure you have signed in to Google in Settings first.' };
      }

      // Convert markdown to document
      const docContent = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <title>${escapeXml(title)}</title>
  <body>
    ${parseMarkdown(content)}
  </body>
</document>`;

      const filePath = `/${title}.docx`;
      await this.fs.writeFile(filePath, docContent);
      
      return { success: true, output: `Document converted and saved to ${filePath}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseMarkdown(markdown: string): string {
  let result = markdown
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return `<heading level="1">${escapeXml(trimmed.slice(2))}</heading>`;
      } else if (trimmed.startsWith('## ')) {
        return `<heading level="2">${escapeXml(trimmed.slice(3))}</heading>`;
      } else if (trimmed.startsWith('### ')) {
        return `<heading level="3">${escapeXml(trimmed.slice(4))}</heading>`;
      } else if (trimmed.startsWith('- ')) {
        return `<list_item>${escapeXml(trimmed.slice(2))}</list_item>`;
      } else if (trimmed) {
        return `<paragraph>${escapeXml(trimmed)}</paragraph>`;
      } else {
        return '';
      }
    })
    .filter(line => line)
    .join('\n');
  
  return result;
}
