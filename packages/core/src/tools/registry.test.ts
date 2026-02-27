import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from './registry.js';
import { Tool, ToolDefinition, ToolResult, ToolCall } from '@pixelmate/shared';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function makeTool(name: string, params: ToolDefinition['parameters'] = [], executor?: (p: Record<string, unknown>) => Promise<ToolResult>): Tool {
  return {
    definition: {
      name,
      description: `A test tool called ${name}`,
      parameters: params,
    },
    execute: executor ?? (() => Promise.resolve({ success: true, output: `${name} executed` })),
  };
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  // ── Registration ──────────────────────────────────────────
  describe('register()', () => {
    it('registers a tool and makes it retrievable', () => {
      const tool = makeTool('echo');
      registry.register(tool);
      expect(registry.has('echo')).toBe(true);
      expect(registry.get('echo')).toBe(tool);
    });

    it('throws when registering a duplicate tool name', () => {
      registry.register(makeTool('dupe'));
      expect(() => registry.register(makeTool('dupe'))).toThrow('already registered');
    });

    it('can register multiple different tools', () => {
      registry.register(makeTool('a'));
      registry.register(makeTool('b'));
      registry.register(makeTool('c'));
      expect(registry.getAll()).toHaveLength(3);
    });
  });

  // ── Unregister ───────────────────────────────────────────
  describe('unregister()', () => {
    it('removes a tool from the registry', () => {
      registry.register(makeTool('temp'));
      registry.unregister('temp');
      expect(registry.has('temp')).toBe(false);
    });

    it('silently ignores unregistering an unknown name', () => {
      expect(() => registry.unregister('nonexistent')).not.toThrow();
    });
  });

  // ── Query ────────────────────────────────────────────────
  describe('getDefinitions()', () => {
    it('returns definitions for all registered tools', () => {
      registry.register(makeTool('x'));
      registry.register(makeTool('y'));
      const defs = registry.getDefinitions();
      expect(defs).toHaveLength(2);
      expect(defs.map(d => d.name)).toEqual(expect.arrayContaining(['x', 'y']));
    });

    it('returns empty array when no tools are registered', () => {
      expect(registry.getDefinitions()).toHaveLength(0);
    });
  });

  // ── Validation ───────────────────────────────────────────
  describe('validateParameters()', () => {
    it('returns valid for correct parameters', () => {
      registry.register(makeTool('greet', [
        { name: 'name', type: 'string', description: 'Person name', required: true },
      ]));
      const result = registry.validateParameters('greet', { name: 'Alice' });
      expect(result.valid).toBe(true);
    });

    it('returns invalid for missing required parameter', () => {
      registry.register(makeTool('greet', [
        { name: 'name', type: 'string', description: 'Person name', required: true },
      ]));
      const result = registry.validateParameters('greet', {});
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns invalid for unknown tool name', () => {
      const result = registry.validateParameters('ghost', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ── Execute ──────────────────────────────────────────────
  describe('execute()', () => {
    it('executes a registered tool and returns its result', async () => {
      registry.register(makeTool('ping', [], async () => ({ success: true, output: 'pong' })));
      const call: ToolCall = { name: 'ping', id: '1', parameters: {} };
      const result = await registry.execute(call);
      expect(result.success).toBe(true);
      expect(result.output).toBe('pong');
    });

    it('returns error result for invalid parameters', async () => {
      registry.register(makeTool('strict', [
        { name: 'value', type: 'number', description: 'A number', required: true },
      ]));
      const call: ToolCall = { name: 'strict', id: '2', parameters: { value: 'not-a-number' } };
      const result = await registry.execute(call);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
    });

    it('returns error result when tool is not found', async () => {
      const call: ToolCall = { name: 'ghost', id: '3', parameters: {} };
      const result = await registry.execute(call);
      expect(result.success).toBe(false);
    });

    it('wraps executor exceptions in a ToolResult error', async () => {
      registry.register(makeTool('boom', [], async () => { throw new Error('KABOOM'); }));
      const call: ToolCall = { name: 'boom', id: '4', parameters: {} };
      const result = await registry.execute(call);
      expect(result.success).toBe(false);
      expect(result.error).toContain('KABOOM');
    });

    it('passes parameters correctly to the executor', async () => {
      let received: Record<string, unknown> = {};
      registry.register(makeTool('spy', [
        { name: 'msg', type: 'string', description: 'msg', required: true },
      ], async (params) => { received = params; return { success: true }; }));

      await registry.execute({ name: 'spy', id: '5', parameters: { msg: 'hello' } });
      expect(received.msg).toBe('hello');
    });
  });
});
