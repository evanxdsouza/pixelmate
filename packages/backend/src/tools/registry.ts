import { Tool, ToolDefinition, ToolResult, ToolCall } from './types.js';
import { createToolSchema } from './types.js';
import { z } from 'zod';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private schemas: Map<string, z.ZodType<Record<string, unknown>>> = new Map();

  register(tool: Tool): void {
    if (this.tools.has(tool.definition.name)) {
      throw new Error(`Tool ${tool.definition.name} is already registered`);
    }
    
    this.tools.set(tool.definition.name, tool);
    this.schemas.set(tool.definition.name, createToolSchema(tool.definition.parameters));
  }

  unregister(name: string): void {
    this.tools.delete(name);
    this.schemas.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(t => t.definition);
  }

  validateParameters(toolName: string, params: Record<string, unknown>): { valid: boolean; error?: string } {
    const schema = this.schemas.get(toolName);
    if (!schema) {
      return { valid: false, error: `Tool ${toolName} not found` };
    }
    
    const result = schema.safeParse(params);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { valid: false, error: `Invalid parameters: ${errors}` };
    }
    
    return { valid: true };
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return { success: false, error: `Tool ${call.name} not found` };
    }
    
    const validation = this.validateParameters(call.name, call.parameters);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    try {
      const result = await tool.execute(call.parameters);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
