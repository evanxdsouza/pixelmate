import { describe, it, expect } from 'vitest';
import { createToolSchema } from './schema.js';
import { ToolParameter } from '@pixelmate/shared';

describe('createToolSchema()', () => {
  function schema(params: ToolParameter[]) {
    return createToolSchema(params);
  }

  it('accepts a valid object matching all required string params', () => {
    const s = schema([
      { name: 'path', type: 'string', description: 'file path', required: true },
    ]);
    const result = s.safeParse({ path: '/tmp/foo.txt' });
    expect(result.success).toBe(true);
  });

  it('rejects when a required string param is missing', () => {
    const s = schema([
      { name: 'path', type: 'string', description: 'file path', required: true },
    ]);
    const result = s.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts missing optional params', () => {
    const s = schema([
      { name: 'mode', type: 'string', description: 'mode', required: false },
    ]);
    const result = s.safeParse({});
    expect(result.success).toBe(true);
  });

  it('validates number type', () => {
    const s = schema([
      { name: 'count', type: 'number', description: 'count', required: true },
    ]);
    expect(s.safeParse({ count: 42 }).success).toBe(true);
    expect(s.safeParse({ count: 'forty-two' }).success).toBe(false);
  });

  it('validates boolean type', () => {
    const s = schema([
      { name: 'flag', type: 'boolean', description: 'flag', required: true },
    ]);
    expect(s.safeParse({ flag: true }).success).toBe(true);
    expect(s.safeParse({ flag: 'true' }).success).toBe(false);
  });

  it('validates object type', () => {
    const s = schema([
      { name: 'data', type: 'object', description: 'data', required: true },
    ]);
    expect(s.safeParse({ data: { key: 'value' } }).success).toBe(true);
    expect(s.safeParse({ data: 'not-an-object' }).success).toBe(false);
  });

  it('validates array type', () => {
    const s = schema([
      { name: 'items', type: 'array', description: 'items', required: true },
    ]);
    expect(s.safeParse({ items: [1, 2, 3] }).success).toBe(true);
    expect(s.safeParse({ items: 'not-an-array' }).success).toBe(false);
  });

  it('validates enum param', () => {
    const s = schema([
      { name: 'color', type: 'string', description: 'color', required: true, enum: ['red', 'green', 'blue'] },
    ]);
    expect(s.safeParse({ color: 'red' }).success).toBe(true);
    expect(s.safeParse({ color: 'yellow' }).success).toBe(false);
  });

  it('handles empty params array', () => {
    const s = schema([]);
    expect(s.safeParse({}).success).toBe(true);
  });

  it('validates multiple params together', () => {
    const s = schema([
      { name: 'name', type: 'string', description: 'name', required: true },
      { name: 'age', type: 'number', description: 'age', required: true },
      { name: 'notes', type: 'string', description: 'notes', required: false },
    ]);
    expect(s.safeParse({ name: 'Alice', age: 30 }).success).toBe(true);
    expect(s.safeParse({ name: 'Bob' }).success).toBe(false); // missing age
  });
});
