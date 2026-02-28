# UI Guide

PixelMate has two entry points that share the same interface:

- **Extension Popup** — click the PixelMate icon in Chrome's toolbar  
- **PWA** — run `pnpm --filter @pixelmate/frontend dev` and open `http://localhost:5173`

---

## Layout

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar                │ Main Area                       │
│ ─────────────────────  │ ────────────────────────────── │
│ PixelMate (logo)       │ Header (current view title)     │
│                        │                                 │
│ [New Chat]             │ Content:                        │
│                        │   Chat / Files / Tools /        │
│ Navigation:            │   Settings                      │
│  • Chat                │                                 │
│  • Files               │                                 │
│  • Tools               │                                 │
│  • Settings            │                                 │
│                        │                                 │
│ Recent Sessions        │                                 │
│ ─────────────────────  │                                 │
│ Status indicator       │                                 │
└─────────────────────────────────────────────────────────┘
```

---

## Chat View

The default view. Type a message and press **Enter** or click **Send**.

### Welcome Screen

Shown when there are no messages yet. Displays three **Quick Action** buttons that pre-fill the input:

| Button | Pre-fills |
|--------|-----------|
| Browse Files | `List files in my workspace` |
| Search Web | `Search the web for latest AI news` |
| Create Spreadsheet | `Create a spreadsheet with sample data` |

### Input Area

- **Textarea** — grows with content; press `Shift+Enter` for a newline
- **Send button** — disabled while a request is in progress
- **Cancel** — appears while the agent is running; stops the current run

### Message Types

| Role | Appearance | When shown |
|------|-----------|-----------|
| `user` | Right-aligned bubble | Your messages |
| `assistant` | Left-aligned bubble | Agent responses and intermediate thoughts |
| `tool` | Dimmed with tool-name badge | Each tool the agent executes |
| `system` | Italic warning text | Errors, extension-not-found notices |

### Extension Banner

When the extension is not detected, a yellow banner appears at the top of the chat area with a link to the installation guide. You can still use the UI in read-only mode.

### Status Indicator

Text below the input shows the agent's current state:

| Status | Meaning |
|--------|---------|
| `starting` | Building the provider and running the first LLM call |
| `thinking` | Agent is processing the LLM response |
| `done` | Run completed successfully |
| `error` | An unrecoverable error occurred |

---

## Files View

Displays all files in your workspace (OPFS + Google Drive if connected).

- Click the **↺ Refresh** button to reload the list
- Click **Grant Access** to grant the Native File System API permission for local files
- File icons differ for files (`📄`) vs directories (`📁`)
- File size is shown for non-directory entries

---

## Tools View

Lists every tool registered in the extension's `ToolRegistry`.

| Column | Description |
|--------|-------------|
| Name | The tool's identifier (e.g. `read_file`) |
| Description | What the tool does |

If the list is empty the extension is not connected. Activate the extension and reload.

---

## Settings View

### AI Provider

| Setting | Description |
|---------|-------------|
| **Provider** | Select `Anthropic`, `OpenAI`, or `Groq` |
| **Model** | Pick from the provider's model list (auto-populated; falls back to static list if no key set yet) |
| **API Key** | Secret key for the selected provider — stored in `chrome.storage.sync` |

Changing the provider immediately re-fetches the model list. Both selections are persisted and restored on next launch.

### Google Workspace

Connect your Google account for Drive, Docs, Sheets, Slides, and Gmail read access. Uses `chrome.identity.getAuthToken()` — no OAuth redirect.

### Local Files

Grant the browser native filesystem access (File System Access API) to read and write files outside the OPFS sandbox.

### Extension Status

Shows whether the extension is detected. If it shows **Not found**, see [Troubleshooting](./troubleshooting.md).

---

## Sidebar: Sessions

The sidebar shows your last 10 sessions. Clicking a session name is a placeholder — full session restore is on the roadmap.

**New Chat** clears all messages and starts a fresh session.

---

## Confirmation Modals

When the agent wants to run a potentially destructive tool (e.g. `delete_file`, `write_file`, `browser_click`), a modal appears:

| Field | Description |
|-------|-------------|
| **Tool** | The tool name |
| **Description** | What the action will do |
| **Risk level** | `low` / `medium` / `high` |
| **Parameters** | Expandable JSON view of the exact arguments |

Click **Approve** to allow, **Deny** to cancel that specific action.
