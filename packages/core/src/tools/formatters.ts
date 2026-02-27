/**
 * Formatter tools for data transformation
 * Browser-compatible implementation
 */

import { Tool, ToolDefinition, ToolResult } from '@pixelmate/shared';

export class FormatAsJSONTool implements Tool {
  definition: ToolDefinition = {
    name: 'format_as_json',
    description: 'Format data as JSON',
    parameters: [
      { name: 'data', description: 'Data to format', type: 'object', required: true },
      { name: 'indent', description: 'Indentation level (default: 2)', type: 'number', required: false }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const data = params.data;
      const indent = (params.indent as number) || 2;
      
      const json = JSON.stringify(data, null, indent);
      return { success: true, output: json };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class FormatAsMarkdownTool implements Tool {
  definition: ToolDefinition = {
    name: 'format_as_markdown',
    description: 'Format data as markdown',
    parameters: [
      { name: 'data', description: 'Data to format', type: 'object', required: true },
      { name: 'title', description: 'Document title', type: 'string', required: false }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const data = params.data as Record<string, unknown>;
      const title = params.title as string;
      
      let markdown = '';
      if (title) {
        markdown += `# ${title}\n\n`;
      }
      
      markdown += this.objectToMarkdown(data);
      return { success: true, output: markdown };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private objectToMarkdown(obj: unknown, depth: number = 0): string {
    if (typeof obj === 'string') {
      return obj;
    }
    
    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        return obj.map(item => `${'  '.repeat(depth)}- ${this.objectToMarkdown(item, depth + 1)}`).join('\n');
      } else {
        const entries = Object.entries(obj);
        return entries
          .map(([key, value]) => {
            const heading = '#'.repeat(Math.min(depth + 2, 6));
            return `${heading} ${key}\n\n${this.objectToMarkdown(value, depth + 1)}\n`;
          })
          .join('\n');
      }
    }
    
    return String(obj);
  }
}

export class ParseJSONTool implements Tool {
  definition: ToolDefinition = {
    name: 'parse_json',
    description: 'Parse JSON string to object',
    parameters: [
      { name: 'json', description: 'JSON string to parse', type: 'string', required: true }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const json = params.json as string;
      const parsed = JSON.parse(json);
      return { success: true, output: JSON.stringify(parsed, null, 2) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class ConvertBetweenFormatsTool implements Tool {
  definition: ToolDefinition = {
    name: 'convert_between_formats',
    description: 'Convert data between different formats',
    parameters: [
      { name: 'data', description: 'Data to convert', type: 'string', required: true },
      { name: 'fromFormat', description: 'Source format (json, csv, yaml)', type: 'string', required: true },
      { name: 'toFormat', description: 'Target format (json, csv, yaml)', type: 'string', required: true }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const data = params.data as string;
      const fromFormat = params.fromFormat as string;
      const toFormat = params.toFormat as string;
      
      // Parse source format
      let parsed: unknown;
      
      switch (fromFormat.toLowerCase()) {
        case 'json':
          parsed = JSON.parse(data);
          break;
        case 'csv':
          parsed = this.parseCSV(data);
          break;
        case 'yaml':
          parsed = this.parseYAML(data);
          break;
        default:
          return { success: false, error: `Unknown source format: ${fromFormat}` };
      }
      
      // Convert to target format
      let result: string;
      
      switch (toFormat.toLowerCase()) {
        case 'json':
          result = JSON.stringify(parsed, null, 2);
          break;
        case 'csv':
          result = this.toCSV(parsed);
          break;
        case 'yaml':
          result = this.toYAML(parsed);
          break;
        default:
          return { success: false, error: `Unknown target format: ${toFormat}` };
      }
      
      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private parseCSV(csv: string): unknown[][] {
    const lines = csv.split('\n');
    return lines.map(line => {
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
  }

  private parseYAML(yaml: string): Record<string, unknown> {
    // Simple YAML parser
    const obj: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':').map(s => s.trim());
        obj[key] = value === 'true' ? true : value === 'false' ? false : value;
      }
    }
    
    return obj;
  }

  private toCSV(data: unknown): string {
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return (data as unknown[][]).map(row =>
        row.map(cell => {
          const str = String(cell);
          if (str.includes(',') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      ).join('\n');
    }
    return String(data);
  }

  private toYAML(data: unknown): string {
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');
    }
    return String(data);
  }
}
