/**
 * Spreadsheet tools using XLSX library and Google Sheets API
 * Browser-compatible implementation
 */

import { Tool, ToolDefinition, ToolResult } from '@pixelmate/shared';
import { HybridFileSystem } from './filesystem.js';

// Simple CSV/XLSX content generator
function generateCSV(data: unknown[][]): string {
  return data.map(row => 
    row.map(cell => {
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  ).join('\n');
}

function generateXLSXLike(data: unknown[][], sheetName: string = 'Sheet1'): string {
  // Simple XML-based spreadsheet format
  const rows = data.map((row, idx) => `
    <row r="${idx + 1}">
      ${row.map((cell, cidx) => `<cell r="${String.fromCharCode(65 + cidx)}${idx + 1}"><value>${escapeXml(String(cell))}</value></cell>`).join('')}
    </row>
  `).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<workbook>
  <sheet name="${escapeXml(sheetName)}">
    ${rows}
  </sheet>
</workbook>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class CreateSpreadsheetTool implements Tool {
  definition: ToolDefinition = {
    name: 'create_spreadsheet',
    description: 'Create a new spreadsheet with data',
    parameters: [
      { name: 'title', description: 'Spreadsheet title', type: 'string', required: true },
      { name: 'data', description: 'Spreadsheet data as 2D array', type: 'array', required: true },
      { name: 'filePath', description: 'Path to save spreadsheet', type: 'string', required: false },
      { name: 'format', description: 'Output format: csv, xlsx, or google', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const title = params.title as string;
      const data = params.data as unknown[][];
      const format = (params.format as string) || 'csv';
      const ext = format === 'xlsx' ? 'xlsx' : format === 'google' ? 'gsheet' : 'csv';
      const filePath = (params.filePath as string) || `/${title}.${ext}`;

      if (format === 'google') {
        return { success: false, error: 'Google Sheets creation requires OAuth setup' };
      }

      let content: string;
      if (format === 'xlsx') {
        content = generateXLSXLike(data, title);
      } else {
        content = generateCSV(data);
      }

      await this.fs.writeFile(filePath, content);
      
      return { success: true, output: `Spreadsheet created at ${filePath}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class ReadSpreadsheetTool implements Tool {
  definition: ToolDefinition = {
    name: 'read_spreadsheet',
    description: 'Read data from a spreadsheet file',
    parameters: [
      { name: 'filePath', description: 'Path to spreadsheet file', type: 'string', required: true },
      { name: 'format', description: 'File format: csv, xlsx, or google', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = params.filePath as string;
      const content = await this.fs.readFile(filePath);

      // Simple CSV parsing
      const lines = content.split('\n');
      const data = lines.map(line => {
        const fields: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            fields.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        if (current) fields.push(current);
        
        return fields;
      });

      return { success: true, output: JSON.stringify(data) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class CreateCSVTool implements Tool {
  definition: ToolDefinition = {
    name: 'create_csv',
    description: 'Create a CSV file with data',
    parameters: [
      { name: 'title', description: 'File title (without extension)', type: 'string', required: true },
      { name: 'data', description: 'Data as 2D array', type: 'array', required: true },
      { name: 'filePath', description: 'Path to save CSV', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const title = params.title as string;
      const data = params.data as unknown[][];
      const filePath = (params.filePath as string) || `/${title}.csv`;

      const content = generateCSV(data);
      await this.fs.writeFile(filePath, content);
      
      return { success: true, output: `CSV created at ${filePath}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class ReadCSVTool implements Tool {
  definition: ToolDefinition = {
    name: 'read_csv',
    description: 'Read data from a CSV file',
    parameters: [
      { name: 'filePath', description: 'Path to CSV file', type: 'string', required: true }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = params.filePath as string;
      const content = await this.fs.readFile(filePath);

      const lines = content.split('\n');
      const data = lines.map(line => {
        const fields: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            fields.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        if (current) fields.push(current);
        
        return fields;
      });

      return { success: true, output: JSON.stringify(data) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
