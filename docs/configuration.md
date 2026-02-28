# Configuration Guide

PixelMate stores all configuration in **`chrome.storage.sync`** — no `.env` file or backend server is needed.  
Settings are managed through the extension's **Settings** view.

---

## Accessing Settings

1. Click the PixelMate toolbar icon
2. Click the **Settings** icon (⚙) in the left sidebar

---

## AI Provider

### Selecting a Provider

Use the **Provider** dropdown to choose between:

| Provider | Models Available |
|----------|----------------|
| Anthropic (Claude) | claude-opus-4-1, claude-sonnet-4, claude-haiku-3, and more |
| OpenAI (GPT) | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, and more |
| Groq (Llama / Mixtral) | llama-3.3-70b-versatile, mixtral-8x7b-32768, and more |

### Selecting a Model

After choosing a provider the **Model** dropdown auto-populates. If an API key for that provider is already saved, the live model list is fetched from the provider's API. Otherwise, a curated static list is shown as a fallback.

The selection is persisted immediately to `chrome.storage.sync`.

### Saving Your API Key

1. Choose a provider
2. Paste your API key into the **API Key** field
3. Click **Save Key**

Keys are stored as `api_key:<provider>` in `chrome.storage.sync` and are scoped to your Chrome profile.

> **Security**: Keys never leave your browser. All LLM calls are made directly from the extension service worker to the provider's API.

---

## Google Workspace

Click **Connect Google** to authenticate via `chrome.identity` OAuth. This grants access to:

- Google Drive (file read/write)
- Google Docs
- Google Sheets
- Google Slides
- Gmail (read-only)

The access token is stored in `chrome.storage.session` (clears when Chrome closes).

Click **Sign Out** to revoke the cached token.

---

## Local Files

Click **Grant Access** to open the Native File System picker and give PixelMate access to a local folder. This supplements the built-in OPFS (Origin Private File System) storage.

---

## Storage Details

| Key | Storage Area | Description |
|-----|-------------|-------------|
| `api_key:anthropic` | `sync` | Anthropic API key |
| `api_key:openai` | `sync` | OpenAI API key |
| `api_key:groq` | `sync` | Groq API key |
| `selected_provider` | `sync` | Last-used provider |
| `selected_model` | `sync` | Last-used model |
| `sessions` | `local` | Up to 50 recent sessions |
| `google_access_token` | `session` | Google OAuth token (ephemeral) |

---

## PWA Environment Variable (Optional)

If you run the standalone PWA frontend (`packages/frontend`) on a different origin than `localhost:5173`, create a `.env.local` in `packages/frontend/`:

```bash
VITE_EXTENSION_ID=your_extension_id_here
```

Find your extension ID at `chrome://extensions`. This is only needed when the PWA origin is not listed in the extension's `externally_connectable` manifest field.

#### LLM Providers
| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_PROVIDER` | `openai` | Default LLM provider |
| `OPENAI_MODEL` | `gpt-4` | Default OpenAI model |
| `ANTHROPIC_MODEL` | `claude-3-opus-20240229` | Default Anthropic model |
| `GROQ_API_KEY` | - | Groq API key |
| `GOOGLE_API_KEY` | - | Google AI API key |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |

#### Advanced Settings
| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_TURNS` | `10` | Maximum agent turns per task |
| `TIMEOUT` | `120000` | Request timeout in ms |
| `BROWSER_HEADLESS` | `true` | Run browser in headless mode |

---

## Provider Configuration

### OpenAI

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4
# Or use GPT-4 Turbo
OPENAI_MODEL=gpt-4-turbo-preview
```

Available models:
- `gpt-4` - Standard GPT-4
- `gpt-4-turbo-preview` - Faster GPT-4
- `gpt-3.5-turbo` - Faster, cheaper option

### Anthropic

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_MODEL=claude-3-opus-20240229
```

Available models:
- `claude-3-opus-20240229` - Most capable
- `claude-3-sonnet-20240229` - Balanced
- `claude-3-haiku-20240307` - Fastest

### Groq

```env
GROQ_API_KEY=gsk_your-key-here
```

Groq uses models like `mixtral-8x7b-32768` for fast inference.

### Google Gemini

```env
GOOGLE_API_KEY=your-google-key
```

### Ollama (Local)

```env
OLLAMA_BASE_URL=http://localhost:11434
```

Pull models with:
```bash
ollama pull llama2
ollama pull codellama
```

---

## Working Directory

The working directory is where file operations occur. Default: `./workspace`

### Changing the Working Directory

1. Via environment variable:
```env
WORKING_DIRECTORY=/path/to/your/folder
```

2. Via the UI:
- Click the ⚙️ Settings icon
- Enter your preferred directory path

### Directory Structure

```
workspace/
├── documents/     # Word documents, PDFs
├── spreadsheets/ # Excel, CSV files
├── presentations/ # PowerPoint files
├── data/        # Data files
└── downloads/   # Downloaded content
```

---

## Security Configuration

### Confirmation Requirements

By default, certain tools require user confirmation before execution:

| Tool | Danger Level | Requires Confirmation |
|------|--------------|----------------------|
| `delete_file` | Critical | Yes |
| `move_file` | Critical | Yes |
| `browser_navigate` | High | Yes |
| `write_file` | Medium | Yes |
| `create_spreadsheet` | Medium | Yes |
| `create_document` | Medium | Yes |
| `web_search` | Low | No |

### Customizing Security Rules

Edit `packages/backend/src/security/config.ts`:

```typescript
export const DANGEROUS_TOOLS: SecurityRule[] = [
  {
    toolName: 'your_custom_tool',
    dangerLevel: 'medium',
    description: 'Your custom tool',
    requiresConfirmation: true  // Change to false to skip confirmation
  }
];
```

---

## Browser Configuration

### Headless Mode

For server environments, browser runs headless by default. To see the browser:

```env
BROWSER_HEADLESS=false
```

### Browser Window Size

```env
BROWSER_VIEWPORT_WIDTH=1280
BROWSER_VIEWPORT_HEIGHT=720
```

### Chrome Extension Settings

Configure extension-specific settings in extension popup.

---

## Database Configuration

PixelMate uses SQLite for persistence. Default location: `./pixelmate.db`

### Custom Database Location

```env
DATABASE_PATH=/path/to/database.db
```

### Database Tables

- `sessions` - Chat sessions
- `messages` - Message history
- `preferences` - User preferences

---

## WebSocket Configuration

The WebSocket endpoint is at `/ws`. Client configuration:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');
```

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `start_task` | Client → Server | Start new agent task |
| `task_started` | Server → Client | Task ID returned |
| `agent_event` | Server → Client | Real-time updates |
| `task_completed` | Server → Client | Task finished |
| `task_error` | Server → Client | Error occurred |
| `confirmation_request` | Server → Client | Confirmation needed |
| `confirmation_response` | Client → Server | User decision |

---

## Performance Tuning

### Agent Turn Limit

```env
MAX_TURNS=10  # Default: 10
```

Increase for complex multi-step tasks.

### Timeout Settings

```env
TIMEOUT=120000  # 2 minutes
```

### Memory Management

For long-running sessions:

```env
MAX_MESSAGES=100  # Keep last 100 messages per session
```

---

## Logging

### Log Levels

```env
LOG_LEVEL=debug  # debug, info, warn, error
```

### Log Output

Logs are written to stdout. For file logging:

```bash
npm run dev:backend > pixelmate.log 2>&1
```

---

## Next Steps

- [Architecture](./architecture.md) - Understand the system design
- [Tools](./tools.md) - Explore available tools
- [Skills](./skills.md) - Learn about skills
- [API Reference](./api.md) - Developer API
