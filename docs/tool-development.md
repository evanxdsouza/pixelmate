# Tool Development

All tools are registered in the extension's `ToolRegistry` at startup. Each tool is a TypeScript class that implements the `Tool` interface from `@pixelmate/shared`.

---

## Tool Interface

```ts
// packages/shared/src/types/tools.ts
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
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
  data?: unknown;
}

export interface Tool {
  definition: ToolDefinition;
  execute(params: Record<string, unknown>): Promise<ToolResult>;
}
```

---

## Creating a Tool

### 1. Create the class

Create a file in `packages/core/src/tools/<category>/myTool.ts`:

```ts
import { Tool, ToolDefinition, ToolResult } from '@pixelmate/shared';

export class MyTool implements Tool {
  definition: ToolDefinition = {
    name: 'my_tool',
    description: 'Short description of what this tool does.',
    parameters: [
      {
        name: 'input',
        type: 'string',
        description: 'The input text to process.',
        required: true,
      },
      {
        name: 'mode',
        type: 'string',
        description: 'Processing mode.',
        required: false,
        enum: ['fast', 'thorough'],
      },
    ],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const input = params.input as string;
    const mode = (params.mode as string) ?? 'fast';

    try {
      const result = mode === 'thorough'
        ? input.split('').reverse().join('') // example logic
        : input.toUpperCase();

      return { success: true, output: result };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
```

### 2. Export from the index

Add the export to `packages/core/src/tools/index.ts`:

```ts
export { MyTool } from './myCategory/myTool.js';
```

### 3. Register in the extension

In `packages/extension-v2/src/background.ts`, import and register:

```ts
import { MyTool } from '@pixelmate/core';

// inside initializeToolRegistry():
toolRegistry.register(new MyTool());
```

---

## Tools That Need the Filesystem

Pass the `HybridFileSystem` instance through the constructor:

```ts
export class MyFileTool implements Tool {
  constructor(private fs: HybridFileSystem) {}

  definition: ToolDefinition = {
    name: 'my_file_tool',
    description: 'Reads something from the filesystem.',
    parameters: [
      { name: 'path', type: 'string', description: 'File path.', required: true },
    ],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const content = await this.fs.readFile(params.path as string);
    return { success: true, output: content };
  }
}
```

Registration:

```ts
toolRegistry.register(new MyFileTool(fileSystem));
```

---

## Dangerous Tools

Tools that require user confirmation before execution are flagged by listing their name in the `DANGEROUS_TOOLS` array inside `packages/core/src/agent/agent.ts`:

```ts
const DANGEROUS_TOOLS = [
  'delete_file', 'move_file', 'write_file', 'create_directory',
  'browser_click', 'browser_type', 'browser_fill',
  // add 'my_tool' here if it needs confirmation
];
```

The agent will call `confirmationHandler` (if provided) before executing any tool whose name appears in this list.

---

## Writing Tests

Add a test file alongside your tool or in the category folder:

```ts
import { describe, it, expect } from 'vitest';
import { MyTool } from './myTool.js';

describe('MyTool', () => {
  const tool = new MyTool();

  it('has the correct name', () => {
    expect(tool.definition.name).toBe('my_tool');
  });

  it('returns uppercased output in fast mode', async () => {
    const result = await tool.execute({ input: 'hello' });
    expect(result.success).toBe(true);
    expect(result.output).toBe('HELLO');
  });

  it('returns error on bad input', async () => {
    const result = await tool.execute({ input: null as any });
    expect(result.success).toBe(false);
  });
});
```

Run with:

```bash
pnpm --filter @pixelmate/core run test
```

---

## Tool Categories

| Category | Directory | Description |
|----------|-----------|-------------|
| Filesystem | `tools/filesystem/` | Read, write, list, delete, move, copy |
| Browser | `tools/browser/` | Navigate, click, fill, get text/HTML, screenshot |
| Documents | `tools/document/` | Create, convert documents |
| Spreadsheets | `tools/spreadsheet/` | Create/read XLSX and CSV |
| Presentations | `tools/presentation/` | Create PPTX, generate slides from outline |
| Formatters | `tools/formatters/` | JSON, Markdown, format conversion |
| Web | `tools/web/` | Web search, fetch page, research topics |
