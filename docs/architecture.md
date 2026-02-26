# Architecture

Detailed overview of PixelMate's system design and component interactions.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PixelMate                                │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Frontend   │◄──►│   Backend    │◄──►│   LLM APIs   │      │
│  │   (React)    │    │  (Express)   │    │ (OpenAI/     │      │
│  │              │    │              │    │  Anthropic)  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                    │                     │              │
│         │                    ▼                     │              │
│         │            ┌──────────────┐             │              │
│         │            │   Tools      │◄────────────┘              │
│         │            │ (Files,     │                           │
│         │            │  Browser,   │                           │
│         │            │  Web)       │                           │
│         │            └──────────────┘                           │
│         │                    │                                  │
│         ▼                    ▼                                  │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │    PWA      │    │   SQLite     │                           │
│  │  (Install)  │    │  (Memory)    │                           │
│  └──────────────┘    └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Frontend (`packages/frontend`)

**Technology:** React + Vite + TypeScript

**Purpose:** User interface for interacting with PixelMate

**Key Files:**
- `src/App.tsx` - Main application component
- `src/main.tsx` - Application entry point
- `src/index.css` - Styling

**Features:**
- Real-time chat interface
- WebSocket connection for live updates
- Confirmation modal for dangerous actions
- PWA support for offline usage

---

### 2. Backend (`packages/backend`)

**Technology:** Node.js + Express + TypeScript

**Purpose:** Server-side processing, tool execution, LLM interaction

**Directory Structure:**
```
packages/backend/src/
├── index.ts              # Entry point, server setup
├── agents/               # Agent implementation
│   ├── agent.ts          # Core agent logic
│   └── index.ts          # Exports
├── providers/            # LLM provider abstraction
│   ├── openai.ts         # OpenAI implementation
│   ├── anthropic.ts      # Anthropic implementation
│   ├── types.ts          # Provider interfaces
│   └── index.ts          # Factory
├── tools/                # Tool implementations
│   ├── types.ts          # Tool definitions
│   ├── registry.ts       # Tool registration
│   ├── filesystem/       # File operations
│   ├── browser/          # Playwright automation
│   ├── spreadsheet/      # Excel/CSV operations
│   ├── document/         # Word document creation
│   ├── presentation/    # PowerPoint generation
│   ├── web/              # Web search/fetch
│   └── formatters/       # Format conversion
├── skills/               # Skill system
│   ├── loader.ts         # Skill loading
│   └── builtin/          # Built-in skills
├── memory/               # Persistence
│   ├── db.ts             # SQLite operations
│   └── index.ts          # Memory interface
├── security/            # Security system
│   ├── config.ts         # Danger level rules
│   ├── queue.ts          # Confirmation queue
│   └── index.ts          # Security exports
└── config/              # Configuration
    └── index.ts          # Environment config
```

---

## Data Flow

### 1. User Request Flow

```
User Input → Frontend → WebSocket → Backend Agent
                │                          │
                │                          ▼
                │                    LLM Processing
                │                          │
                │                          ▼
                │                    Tool Execution
                │                          │
                │                          ▼
                │                    Tool Results
                │                          │
                ◄─────────────────────────┘
```

### 2. Tool Execution Flow

```
Agent decides to use tool
         │
         ▼
┌─────────────────┐
│ Check security │
│    rules        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Requires       │──Yes──► Confirmation
│ confirmation?  │         Queue
└────────┬────────┘
         │ No
         ▼
┌─────────────────┐
│ ToolRegistry   │
│ .execute()     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Tool.execute() │
│ (sandboxed)    │
└────────┬────────┘
         │
         ▼
    Result returned
```

---

## Security Architecture

### Sandboxing

**File System Sandbox:**
- All file operations restricted to working directory
- Path traversal prevention
- Configurable allowed operations

**Browser Sandbox:**
- Runs in headless mode by default
- Isolated browser contexts
- Timeout protections

### Confirmation System

```
Dangerous Action
        │
        ▼
┌─────────────────┐
│ Check danger    │
│ level           │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Medium+ │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│ Queue request   │
│ WebSocket push  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Wait for user  │
│ approval       │
└────────┬────────┘
         │
    ┌────┴────┐
    │Approve/ │
    │ Deny    │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│ Execute or     │
│ cancel         │
└─────────────────┘
```

---

## Provider Abstraction

### Interface

```typescript
interface LLMProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  getModel(): string;
  setModel(model: string): void;
}
```

### Supported Providers

| Provider | Package | Models |
|----------|---------|--------|
| OpenAI | `openai` | GPT-4, GPT-3.5 |
| Anthropic | `@anthropic-ai/sdk` | Claude 3 |
| Groq | API (REST) | Mixtral, Llama |
| Google | `@google/generative-ai` | Gemini |
| Ollama | REST | Local models |

---

## Tool System

### Tool Interface

```typescript
interface Tool {
  definition: ToolDefinition;
  execute, unknown>): Promise(params: Record<string<ToolResult>;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

interface ToolParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  default?: unknown;
}
```

### Tool Categories

1. **Filesystem** - File read/write operations
2. **Spreadsheet** - Excel/CSV generation
3. **Document** - Word document creation
4. **Presentation** - PowerPoint generation
5. **Browser** - Web automation
6. **Web** - Search and fetch
7. **Formatters** - Data conversion

---

## State Management

### Agent State

```
idle → thinking → acting → done
  │        │          │
  │        └────▲─────┘
  │               │
  └──────► error ◄─┘
```

### Session State

- Session ID
- Message history
- Working directory
- Current task

---

## Database Schema

### Sessions Table

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Messages Table

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT,
  content TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### Preferences Table

```sql
CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

---

## WebSocket Protocol

### Connection Lifecycle

1. Client connects to `/ws`
2. Server assigns client ID
3. Client sends authentication (if configured)
4. Bidirectional message exchange
5. Connection closed or client disconnects

### Message Format

```typescript
interface WSMessage {
  type: string;
  [key: string]: unknown;
}
```

---

## Extension Points

### Custom Tools

1. Implement `Tool` interface
2. Register with `ToolRegistry`
3. Add security rules if needed

### Custom Skills

1. Create markdown file in `skills/builtin/`
2. Define instructions and parameters
3. Agent auto-detects skill usage

### Custom Providers

1. Implement `LLMProvider` interface
2. Add to provider factory
3. Configure in environment

---

## Performance Considerations

### Concurrent Requests

- Node.js event loop handles concurrent I/O
- WebSocket connections pooled

### Memory Management

- Sessions stored in SQLite
- Message history limited per session
- Tool results not cached long-term

### Browser Resources

- Single browser instance shared
- Pages created/destroyed per task
- Headless mode for efficiency

---

## Deployment

### Development

```
npm run dev          # Both servers
npm run dev:backend  # Backend only
npm run dev:frontend # Frontend only
```

### Production

```
npm run build        # Build both
npm start            # Run production
```

### Docker

```bash
docker build -t pixelmate .
docker run -p 3001:3001 pixelmate
```

---

## Next Steps

- [Tools Reference](./tools.md) - Complete tool documentation
- [Configuration](./configuration.md) - Settings guide
- [Security](./security.md) - Security details
- [Troubleshooting](./troubleshooting.md) - Common issues
