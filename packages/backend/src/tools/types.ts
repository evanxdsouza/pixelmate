import { z } from 'zod';

export interface ToolParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  default?: unknown;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface Tool {
  definition: ToolDefinition;
  execute(params: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolCall {
  name: string;
  id: string;
  parameters: Record<string, unknown>;
}

export function createToolSchema(parameters: ToolParameter[]): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  
  for (const param of parameters) {
    let schema: z.ZodTypeAny;
    
    switch (param.type) {
      case 'string':
        schema = z.string();
        break;
      case 'number':
        schema = z.number();
        break;
      case 'boolean':
        schema = z.boolean();
        break;
      case 'object':
        schema = z.record(z.unknown());
        break;
      case 'array':
        schema = z.array(z.unknown());
        break;
      default:
        schema = z.unknown();
    }
    
    if (!param.required) {
      schema = schema.optional();
    }
    
    if (param.enum && param.enum.length > 0) {
      schema = z.enum(param.enum as [string, ...string[]]) as z.ZodTypeAny;
    }
    
    shape[param.name] = schema;
  }
  
  return z.object(shape);
}

export function toolToMarkdown(tool: Tool): string {
  let md = `### ${tool.definition.name}\n\n`;
  md += `${tool.definition.description}\n\n`;
  md += `**Parameters:**\n`;
  
  for (const param of tool.definition.parameters) {
    const required = param.required ? '(required)' : '(optional)';
    md += `- \`${param.name}\` (${param.type}) ${required}: ${param.description}\n`;
  }
  
  return md;
}
