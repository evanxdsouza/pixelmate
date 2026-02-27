import { z } from 'zod';
import { ToolParameter } from '@pixelmate/shared';

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

export function toolToMarkdown(definition: { name: string; description: string; parameters: ToolParameter[] }): string {
  let md = `### ${definition.name}\n\n`;
  md += `${definition.description}\n\n`;
  md += `**Parameters:**\n`;
  
  for (const param of definition.parameters) {
    const required = param.required ? '(required)' : '(optional)';
    md += `- \`${param.name}\` (${param.type}) ${required}: ${param.description}\n`;
  }
  
  return md;
}
