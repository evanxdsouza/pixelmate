# Architecture

> This document reflects the **v0.1.0** implementation: a Chrome Extension MV3 service worker + optional React PWA, with no backend Node.js server.

PixelMate's architecture centers on a **Chrome Extension MV3 service worker** that acts as both the AI agent runtime and the "backend". A React PWA connects to it via the `ExtensionBridge` using `chrome.runtime` messaging, with no Node.js server required.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│                                                                     │
│  ┌─────────────────────────┐    chrome.runtime messaging           │
│  │  Frontend (React PWA)   │◄──────────────────────────────┐       │
│  │  packages/frontend      │                               │       │
│  │  ExtensionBridge        │                               │       │
│  └─────────────────────────┘                               │       │
│                                                             │       │
│  ┌──────────────────────────────────────────────────────────▼────┐ │
│  │  Extension Service Worker (packages/extension-v2)             │ │
│  │                                                               │ │
│  │  handleMessage()  ◄── one-shot messages (sendMessage)        │ │
│  │  handlePortMessage() ◄── streaming runs (connect 'agent')    │ │
│  │                                                               │ │
│  │  ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐   │ │
│  │  │  Agent      │   │ ToolRegistry │   │ HybridFileSys.  │   │ │
│  │  │ (core)      │   │  (core)      │   │  OPFS + Drive   │   │ │
│  │  └──────┬──────┘   └──────┬───────┘   └─────────────────┘   │ │
│  │         │                 │                                   │ │
│  │         ▼                 ▼                                   │ │
│  │  ┌─────────────────────────────┐                             │ │
│  │  │  LLM Provider               │                             │ │
│  │  │  Anthropic / OpenAI / Groq  │◄──── API keys from         │ │
│  │  └─────────────────────────────┘      chrome.storage.sync   │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Path | Role |
|---------|------|------|
| `@pixelmate/shared` | `packages/shared` | TypeScript types and interfaces |
| `@pixelmate/core` | `packages/core` | Agent loop, ToolRegistry, Providers, Skills |
| `@pixelmate/extension` | `packages/extension-v2` | MV3 service worker, popup React app |
| `@pixelmate/frontend` | `packages/frontend` | Standalone React PWA |

### Dependency Graph

```
shared → core → extension-v2
                      └─ frontend  (connected at runtime via chrome.runtime)
```

---

## Core Package (`@pixelmate/core`)

### Agent (`src/agent/agent.ts`)

The agent implements a **think → act → observe** loop:

```
run(prompt)
  └─ runAgentLoop()
        ├─ provider.chatStream()          LLM generates response
        ├─ extractToolCalls()             Parse [TOOL_CALL]…[/TOOL_CALL] tags
        ├─ confirmationHandler?()         Ask user for dangerous tools
        ├─ toolRegistry.execute()         Run the tool
        └─ loop until no more tool calls or maxTurns reached
```

**Events emitted**: `state_change`, `thought`, `tool_call`, `tool_result`, `message`, `error`

**Tool call format** (in LLM output):
```
[TOOL_CALL]tool_name: {"param": "value"}[/TOOL_CALL]
```

**Options**:

| Option | Default | Description |
|--------|---------|-------------|
| `systemPrompt` | `undefined` | Overrides the default prompt (used by skills) |
| `maxTurns` | `50` | Maximum agent loop iterations |
| `model` | Provider default | Model string passed to the LLM |
| `workingDirectory` | `undefined` | Base path for filesystem tools |
| `confirmationHandler` | `undefined` | Called before dangerous tool execution |

---

### ToolRegistry (`src/tools/registry.ts`)

- Stores tools by name
- `register(tool)` — throws if duplicate name
- `execute(name, params)` — validates params via Zod, returns `ToolResult`
- `getDefinitions()` — serialisable list sent to the frontend via `GET_TOOLS`

---

### Providers (`src/providers/`)

Each provider implements `LLMProvider`:

```ts
interface LLMProvider {
  name: string;
  chat(options: ChatOptions): Promise<ChatResponse>;
  chatStream(options: ChatOptions): AsyncGenerator<StreamingChunk>;
  listModels(): Promise<string[]>;
}
```

| Provider | Default model |
|----------|---------------|
| `AnthropicProvider` | `claude-sonnet-4` |
| `OpenAIProvider` | `gpt-4o` |
| `GroqProvider` | `llama-3.3-70b-versatile` |

---

### Skills (`src/skills/index.ts`)

6 built-in skill presets (system prompts): `document`, `email`, `presentation`, `spreadsheet`, `research`, `code`.

`getSkillPrompt(skill)` is case-insensitive and falls back to a generic assistant prompt.

---

## Extension Service Worker (`@pixelmate/extension`)

### Startup

1. `chrome.runtime.onInstalled` fires
2. `fileSystem.initializeOPFS()` sets up Origin Private File System
3. `initializeToolRegistry()` registers all 33 tools

### Message Handling

Two channels:

| Channel | API | Use |
|---------|-----|-----|
| One-shot | `chrome.runtime.sendMessage` → `handleMessage()` | Config, keys, files, sessions |
| Streaming | `chrome.runtime.connect('agent')` → `handlePortMessage()` | Agent execution with real-time events |

Full message reference: [API Reference](./api.md)

### Filesystem

`HybridFileSystem` layers three storage backends:

| Backend | Access | Persistence |
|---------|--------|-------------|
| OPFS (Origin Private FS) | Always available | Permanent |
| Google Drive | After OAuth | Cloud |
| Native File System API | After `requestNativeAccess()` | Local disk |

---

## Frontend PWA (`@pixelmate/frontend`)

### ExtensionBridge

`packages/frontend/src/services/ExtensionBridge.ts` — singleton (`bridge`) that:

- Resolves the extension ID from `chrome.runtime.id` → `window.__PIXELMATE_EXT_ID` → `VITE_EXTENSION_ID`
- Wraps `chrome.runtime.sendMessage` for one-shot requests
- Uses `chrome.runtime.connect('agent')` for streaming agent runs
- Exposes typed methods: `getModels`, `setProvider`, `executeAgent`, `getFiles`, etc.

### Data Flow — One-shot

```
App.tsx  →  bridge.setApiKey()  →  sendMessage({ type: 'SET_API_KEY', … })
                                         ↓
                               background.ts handleMessage()
                                         ↓
                               chrome.storage.sync.set(…)
                                         ↓
                               sendResponse({ success: true })
```

### Data Flow — Streaming Agent Run

```
App.tsx  →  bridge.executeAgent()  →  chrome.runtime.connect('agent')
                                             ↓ port.postMessage AGENT_EXECUTE
                                       background.ts handlePortMessage()
                                             ↓
                                       executeAgentWithStream()
                                             ↓ agent.onEvent(…)
                                       port.postMessage AGENT_EVENT
                                             ↓
                               App.tsx handleAgentEvent() → setMessages(…)
                                             ↓ when done
                                       port.postMessage AGENT_COMPLETE
```

---

## Security Model

| Concern | Mechanism |
|---------|----------|
| API keys | Stored in `chrome.storage.sync`, never sent to any PixelMate server |
| Dangerous tools | Listed in `DANGEROUS_TOOLS`; `confirmationHandler` called before execution |
| Confirmation | Modal in App.tsx shows tool, description, risk level, and exact params |
| Google OAuth | `chrome.identity.getAuthToken()` — no redirect, token in `chrome.storage.session` |
| Origin isolation | Extension talks only to whitelisted origins in `externally_connectable` |

---

## Testing Architecture

| Package | Framework | Environment |
|---------|-----------|-------------|
| `@pixelmate/core` | Vitest | Node |
| `@pixelmate/extension` | Vitest | Node (chrome mocked) |
| `@pixelmate/frontend` | Vitest + Testing Library | jsdom |

Run all tests: `pnpm run test`

