# API Reference

PixelMate uses `chrome.runtime` messaging between the PWA/popup and the extension service worker. There is no HTTP server.

Messages are sent via:
- **`chrome.runtime.sendMessage`** — one-shot request/response (handled by `handleMessage()`)
- **`chrome.runtime.connect('agent')`** — persistent port for streaming agent runs (handled by `handlePortMessage()`)

---

## One-Shot Messages

All one-shot messages expect `sendResponse({ success: boolean, ...data })`. If `success` is `false`, `error` contains the message.

---

### `SET_API_KEY`

Save an API key for a provider to `chrome.storage.sync`.

**Request**
```ts
{ type: 'SET_API_KEY', provider: string, apiKey: string }
```

**Response**
```ts
{ success: true }
```

---

### `GET_CONFIG`

Read one or more values from `chrome.storage.sync`.

**Request**
```ts
{ type: 'GET_CONFIG', keys: string[] }
```

**Response**
```ts
{ success: true, values: Record<string, unknown> }
```

**Common keys**

| Key | Description |
|-----|-------------|
| `selected_provider` | Active provider ID (`'anthropic'` \| `'openai'` \| `'groq'`) |
| `selected_model` | Active model string |
| `api_key:anthropic` | Anthropic API key |
| `api_key:openai` | OpenAI API key |
| `api_key:groq` | Groq API key |

---

### `GET_MODELS`

Get available model IDs for a provider. Tries a live API call first; falls back to a static list if the key isn't set yet.

**Request**
```ts
{ type: 'GET_MODELS', provider: string }
```

**Response**
```ts
{ success: true, models: string[] }
```

---

### `SET_PROVIDER`

Persist the selected provider (and optionally model) to `chrome.storage.sync`.

**Request**
```ts
{ type: 'SET_PROVIDER', provider: string, model?: string }
```

**Response**
```ts
{ success: true }
```

---

### `GET_TOOLS`

Return the list of all registered tools.

**Request**
```ts
{ type: 'GET_TOOLS' }
```

**Response**
```ts
{
  success: true,
  tools: Array<{
    name: string;
    description: string;
    parameters: ToolParameter[];
  }>
}
```

---

### `GET_FILES`

List all files and directories in the workspace root (`'/'`).

**Request**
```ts
{ type: 'GET_FILES' }
```

**Response**
```ts
{
  success: true,
  files: Array<{
    name: string;          // filename without trailing /
    type: 'file' | 'directory';
  }>
}
```

---

### `GET_SESSIONS`

Return up to the 10 most recent sessions from `chrome.storage.local`.

**Request**
```ts
{ type: 'GET_SESSIONS' }
```

**Response**
```ts
{ success: true, sessions: Array<{ id: string; title: string; createdAt: string }> }
```

---

### `SAVE_SESSION`

Upsert a session. Keeps the most recent 50 sessions.

**Request**
```ts
{ type: 'SAVE_SESSION', session: { id: string; title: string; createdAt: string } }
```

**Response**
```ts
{ success: true }
```

---

### `REQUEST_FILE_ACCESS`

Trigger the File System Access API native picker to grant access to a local directory.

**Request**
```ts
{ type: 'REQUEST_FILE_ACCESS' }
```

**Response**
```ts
{ success: true }
```

---

### `INIT_GOOGLE_DRIVE`

Initialise the Google Drive layer in `HybridFileSystem` with an existing access token.

**Request**
```ts
{ type: 'INIT_GOOGLE_DRIVE', accessToken: string }
```

**Response**
```ts
{ success: true }
```

---

### `GOOGLE_AUTH`

Start interactive Google OAuth via `chrome.identity.getAuthToken()`. Grants Drive, Docs, Sheets, Slides, and Gmail read scopes. On success the token is stored in `chrome.storage.session`.

**Request**
```ts
{ type: 'GOOGLE_AUTH' }
```

**Response**
```ts
{ success: true, token: string }
```

---

### `GOOGLE_SIGNOUT`

Revoke and remove the cached Google access token.

**Request**
```ts
{ type: 'GOOGLE_SIGNOUT' }
```

**Response**
```ts
{ success: true }
```

---

### `AGENT_EXECUTE` (one-shot)

Run an agent task synchronously and wait for the final result. Use the port-based version for real-time streaming.

**Request**
```ts
{
  type: 'AGENT_EXECUTE';
  prompt: string;
  provider?: string;   // defaults to saved provider
  model?: string;      // defaults to provider default
  skill?: string;      // 'document' | 'email' | 'presentation' | 'spreadsheet' | 'research' | 'code'
}
```

**Response**
```ts
{ success: true, result: string }
```

---

## Streaming Agent Runs (Port)

For real-time event streaming, open a persistent connection:

```ts
const port = chrome.runtime.connect({ name: 'agent' });
```

### Client → Service Worker

#### `AGENT_EXECUTE`

```ts
port.postMessage({
  type: 'AGENT_EXECUTE',
  prompt: string,
  provider?: string,
  model?: string,
  skill?: string,
});
```

### Service Worker → Client

#### `AGENT_EVENT`

Emitted for each event in the agent loop.

```ts
{
  type: 'AGENT_EVENT',
  event: {
    type: 'state_change' | 'thought' | 'tool_call' | 'tool_result' | 'message' | 'error';
    // depending on event.type one of:
    state?: 'idle' | 'thinking' | 'acting' | 'done' | 'error';
    thought?: string;
    toolCall?: { name: string; parameters?: Record<string, unknown> };
    toolResult?: { success: boolean; output?: string; error?: string };
    message?: string;
    error?: string;
  }
}
```

#### `AGENT_COMPLETE`

Sent when the agent loop finishes. The port is closed by the service worker after this.

```ts
{ type: 'AGENT_COMPLETE', result: string }
```

#### `ERROR`

Sent on unrecoverable errors.

```ts
{ type: 'ERROR', error: string }
```

---

## ExtensionBridge (Frontend)

The PWA wraps all of the above in a typed singleton:

```ts
import { bridge } from './services/ExtensionBridge';

// Check extension availability
bool = bridge.isAvailable();

// One-shot helpers
await bridge.setApiKey('anthropic', 'sk-ant-…');
await bridge.setProvider('openai', 'gpt-4o');
const models  = await bridge.getModels('anthropic');    // string[]
const config  = await bridge.getConfig(['selected_provider']);
const tools   = await bridge.getTools();
const files   = await bridge.getFiles();
const sessions = await bridge.getSessions();
await bridge.saveSession({ id, title, createdAt });
const token   = await bridge.googleSignIn();
await bridge.googleSignOut();
await bridge.requestFileAccess();

// Streaming execution — returns a cancel() function
const cancel = bridge.executeAgent(
  prompt,
  { provider: 'anthropic', model: 'claude-sonnet-4', skill: 'research' },
  (event) => console.log(event),            // onEvent
  (result) => console.log(result),          // onComplete
  (error) => console.error(error),          // onError
);

// Cancel mid-run
cancel();
```


