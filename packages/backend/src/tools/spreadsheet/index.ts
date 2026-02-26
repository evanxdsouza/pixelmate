import { Tool, ToolResult, ToolParameter } from '../types.js';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { PathSandbox } from '../filesystem/sandbox.js';

type ParamType = 'string' | 'number' | 'boolean' | 'object' | 'array';

function param(name: string, description: string, type: ParamType, required: boolean, defaultValue?: unknown): ToolParameter {
  return { name, description, type, required, default: defaultValue };
}

export class CreateSpreadsheetTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'create_spreadsheet',
    description: 'Create an Excel spreadsheet (.xlsx) file with data. Supports multiple sheets, formatting, and formulas.',
    parameters: [
      param('path', 'The path for the output Excel file (relative to working directory, e.g., "report.xlsx")', 'string', true),
      param('sheets', 'Array of sheet objects with name and data (array of objects/arrays). Example: [{"name": "Sales", "data": [["Header1", "Header2"], ["Value1", "Value2"]]}]', 'array', true),
      param('options', 'Optional settings: sheetNames (string array), freezeRows (number), freezeCols (number)', 'object', false)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = this.sandbox.resolve(params.path as string);
      const sheets = params.sheets as Array<{ name: string; data: unknown[][] }>;
      const options = (params.options as Record<string, unknown>) || {};

      const workbook = XLSX.utils.book_new();

      for (const sheet of sheets) {
        const sheetName = sheet.name || 'Sheet1';
        const data = sheet.data;

        if (!Array.isArray(data) || data.length === 0) {
          continue;
        }

        const worksheet = XLSX.utils.aoa_to_sheet(data);

        if (options.freezeRows) {
          worksheet['!freeze'] = { top: options.freezeRows as number, left: options.freezeCols || 0 };
        }

        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
      }

      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      await fs.writeFile(filePath, buffer);

      return { success: true, output: `Spreadsheet created: ${params.path} with ${sheets.length} sheet(s)` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class ReadSpreadsheetTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'read_spreadsheet',
    description: 'Read data from an Excel spreadsheet and return it as JSON',
    parameters: [
      param('path', 'The path to the Excel file to read (relative to working directory)', 'string', true),
      param('sheet', 'Optional sheet name or index to read. If not specified, returns all sheets.', 'string', false),
      param('asJson', 'Return data as JSON array of objects (true) or array of arrays (false)', 'boolean', false, true)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = this.sandbox.resolve(params.path as string);
      const sheetName = params.sheet as string | undefined;
      const asJson = params.asJson !== false;

      const buffer = await fs.readFile(filePath);
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const result: Record<string, unknown> = {};

      const sheetsToRead = sheetName 
        ? [{ name: sheetName, worksheet: workbook.Sheets[sheetName] }]
        : workbook.SheetNames.map(name => ({ name, worksheet: workbook.Sheets[name] }));

      for (const { name, worksheet } of sheetsToRead) {
        if (asJson) {
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          result[name] = jsonData;
        } else {
          const aoaData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          result[name] = aoaData;
        }
      }

      return { success: true, output: JSON.stringify(result, null, 2) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class CreateCsvTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'create_csv',
    description: 'Create a CSV file from data',
    parameters: [
      param('path', 'The path for the output CSV file (relative to working directory)', 'string', true),
      param('data', 'Array of objects to export as CSV, or array of arrays for raw CSV data', 'array', true),
      param('headers', 'Optional array of header names if data is array of arrays', 'array', false)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = this.sandbox.resolve(params.path as string);
      const data = params.data as unknown[];
      const headers = params.headers as string[] | undefined;

      let csvContent: string;

      if (data.length > 0 && typeof data[0] === 'object' && !Array.isArray(data[0])) {
        const objects = data as Record<string, unknown>[];
        const keys = headers || Object.keys(objects[0]);
        
        const headerRow = keys.join(',');
        const rows = objects.map(obj => 
          keys.map(key => {
            const value = obj[key];
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        );
        
        csvContent = [headerRow, ...rows].join('\n');
      } else {
        const aoa = data as unknown[][];
        if (headers) {
          csvContent = [headers.join(','), ...aoa.map(row => 
            row.map(cell => {
              if (cell === null || cell === undefined) return '';
              const str = String(cell);
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            }).join(',')
          )].join('\n');
        } else {
          csvContent = aoa.map(row => 
            row.map(cell => {
              if (cell === null || cell === undefined) return '';
              const str = String(cell);
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            }).join(',')
          ).join('\n');
        }
      }

      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(filePath, csvContent, 'utf-8');

      return { success: true, output: `CSV created: ${params.path} with ${data.length} rows` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class ReadCsvTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'read_csv',
    description: 'Read a CSV file and return data as JSON',
    parameters: [
      param('path', 'The path to the CSV file to read (relative to working directory)', 'string', true),
      param('hasHeaders', 'Whether the first row contains headers (default: true)', 'boolean', false, true)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = this.sandbox.resolve(params.path as string);
      const hasHeaders = params.hasHeaders !== false;

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        return { success: true, output: '[]' };
      }

      const parseRow = (row: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            if (inQuotes && row[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      let result: unknown;

      if (hasHeaders) {
        const headers = parseRow(lines[0]);
        const rows = lines.slice(1).map(line => {
          const values = parseRow(line);
          const obj: Record<string, string> = {};
          headers.forEach((header, i) => {
            obj[header] = values[i] || '';
          });
          return obj;
        });
        result = rows;
      } else {
        result = lines.map(line => parseRow(line));
      }

      return { success: true, output: JSON.stringify(result, null, 2) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
