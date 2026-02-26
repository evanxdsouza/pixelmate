import { Tool, ToolResult, ToolParameter } from '../types.js';
import fs from 'fs/promises';
import path from 'path';
import { PathSandbox } from '../filesystem/sandbox.js';

type ParamType = 'string' | 'number' | 'boolean' | 'object' | 'array';

function param(name: string, description: string, type: ParamType, required: boolean, defaultValue?: unknown): ToolParameter {
  return { name, description, type, required, default: defaultValue };
}

export class FormatAsJsonTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'format_as_json',
    description: 'Format data as JSON and optionally save to a file',
    parameters: [
      param('data', 'The data to format as JSON (object, array, or string to parse)', 'object', true),
      param('path', 'Optional path to save the JSON file', 'string', false),
      param('pretty', 'Whether to format with indentation (default: true)', 'boolean', false, true)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      let data = params.data;
      
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return { success: false, error: 'Invalid JSON string' };
        }
      }

      const pretty = params.pretty !== false;
      const jsonStr = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

      if (params.path) {
        const filePath = this.sandbox.resolve(params.path as string);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, jsonStr, 'utf-8');
        return { success: true, output: `JSON saved to ${params.path}` };
      }

      return { success: true, output: jsonStr };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class FormatAsMarkdownTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'format_as_markdown',
    description: 'Convert data to markdown format (tables, lists, etc.) and optionally save to a file',
    parameters: [
      param('data', 'The data to convert to markdown. Supports: { type: "table", data: {headers, rows} }, { type: "list", data: [] }, { type: "report", title, sections: [] }', 'object', true),
      param('path', 'Optional path to save the markdown file', 'string', false)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const data = params.data as Record<string, unknown>;
      let markdown = '';

      if (data.type === 'table') {
        const tableData = data.data as { headers: string[]; rows: (string | number)[][] };
        const headers = tableData.headers;
        const rows = tableData.rows;

        markdown += '| ' + headers.join(' | ') + ' |\n';
        markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
        
        for (const row of rows) {
          markdown += '| ' + row.map(cell => String(cell)).join(' | ') + ' |\n';
        }
      } else if (data.type === 'list') {
        const items = data.data as string[];
        for (const item of items) {
          markdown += `- ${item}\n`;
        }
      } else if (data.type === 'report') {
        const title = data.title as string;
        const sections = data.sections as Array<{ heading?: string; content: string | string[] }>;
        
        if (title) {
          markdown += `# ${title}\n\n`;
        }

        for (const section of sections) {
          if (section.heading) {
            markdown += `## ${section.heading}\n\n`;
          }
          
          if (Array.isArray(section.content)) {
            for (const item of section.content) {
              markdown += `${item}\n\n`;
            }
          } else {
            markdown += `${section.content}\n\n`;
          }
        }
      } else if (data.type === 'keyValue') {
        const entries = data.data as Record<string, string | number>;
        for (const [key, value] of Object.entries(entries)) {
          markdown += `**${key}**: ${value}\n\n`;
        }
      } else {
        markdown = JSON.stringify(data, null, 2);
      }

      if (params.path) {
        const filePath = this.sandbox.resolve(params.path as string);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, markdown, 'utf-8');
        return { success: true, output: `Markdown saved to ${params.path}` };
      }

      return { success: true, output: markdown };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class ParseJsonTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'parse_json',
    description: 'Parse JSON string or read JSON file and return structured data',
    parameters: [
      param('input', 'JSON string to parse or file path (if it looks like a path)', 'string', true)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const input = params.input as string;
      let result: unknown;

      if (input.startsWith('{') || input.startsWith('[')) {
        result = JSON.parse(input);
      } else {
        const filePath = this.sandbox.resolve(input);
        const content = await fs.readFile(filePath, 'utf-8');
        result = JSON.parse(content);
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

export class ConvertBetweenFormatsTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'convert_format',
    description: 'Convert data between formats (CSV to JSON, JSON to CSV, etc.)',
    parameters: [
      param('input', 'Input data (string or file path)', 'string', true),
      param('fromFormat', 'Source format: csv, json, markdown', 'string', true),
      param('toFormat', 'Target format: csv, json, markdown', 'string', true),
      param('outputPath', 'Optional path to save the converted output', 'string', false)
    ]
  };

  private parseCsv(content: string): Record<string, string>[] {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

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

    const headers = parseRow(lines[0]);
    
    return lines.slice(1).map(line => {
      const values = parseRow(line);
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] || '';
      });
      return obj;
    });
  }

  private toCsv(data: Record<string, string>[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const lines = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(h => {
        const val = row[h] || '';
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      lines.push(values.join(','));
    }
    
    return lines.join('\n');
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const input = params.input as string;
      const fromFormat = (params.fromFormat as string).toLowerCase();
      const toFormat = (params.toFormat as string).toLowerCase();
      
      let data: unknown;
      
      if (input.startsWith('{') || input.startsWith('[')) {
        if (fromFormat === 'json') {
          data = JSON.parse(input);
        } else {
          data = input;
        }
      } else {
        const filePath = this.sandbox.resolve(input);
        const content = await fs.readFile(filePath, 'utf-8');
        
        if (fromFormat === 'json') {
          data = JSON.parse(content);
        } else if (fromFormat === 'csv') {
          data = this.parseCsv(content);
        } else {
          data = content;
        }
      }

      let output: string;

      if (toFormat === 'json') {
        output = JSON.stringify(data, null, 2);
      } else if (toFormat === 'csv') {
        if (Array.isArray(data)) {
          const records = data as Record<string, unknown>[];
          const csvData = records.map(r => {
            const obj: Record<string, string> = {};
            for (const [k, v] of Object.entries(r)) {
              obj[k] = String(v);
            }
            return obj;
          });
          output = this.toCsv(csvData);
        } else {
          return { success: false, error: 'Cannot convert to CSV: data is not an array' };
        }
      } else {
        output = String(data);
      }

      if (params.outputPath) {
        const filePath = this.sandbox.resolve(params.outputPath as string);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, output, 'utf-8');
        return { success: true, output: `Converted ${fromFormat} to ${toFormat}: ${params.outputPath}` };
      }

      return { success: true, output };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
