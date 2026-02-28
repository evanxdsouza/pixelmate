# Chrome Extension

PixelMate is a **Manifest V3** Chrome Extension. The service worker (`background.ts`) runs the full agent loop — LLM calls, tool execution, and filesystem operations — with no server required.

---

## Loading the Extension (Development)

> **Prerequisites**: Node.js 18+, pnpm 8+

### 1. Build

```bash
pnpm install
pnpm --filter @pixelmate/extension run build
```

This produces `packages/extension-v2/dist/` containing:

```
dist/
  manifest.json       ← auto-generated from source manifest + package version
  background.js       ← service worker bundle (~315 KB gzip ~87 KB)
  content.js          ← content script (~2.7 KB)
  popup.js            ← React popup bundle (~145 KB)
  src/popup/index.html
```

### 2. Open Chrome Extensions

Navigate to `chrome://extensions` and enable **Developer mode** (top-right toggle).

### 3. Load Unpacked

Click **Load unpacked** and select the `packages/extension-v2/dist/` folder.

PixelMate appears in your toolbar. Pin it for easy access.

### 4. Reload After Changes

After rebuilding, click the **↺ refresh** button on the extension card in `chrome://extensions`.

---

## Manifest Permissions

| Permission | Why it's needed |
|-----------|----------------|
| `activeTab` | Read the current tab URL and interact with page content |
| `scripting` | Inject the content script for browser automation tools |
| `tabs` | Query and manage tabs |
| `storage` | `chrome.storage.sync/local/session` for keys & sessions |
| `notifications` | Alert the user when a long agent task completes |
| `unlimitedStorage` | OPFS filesystem can grow beyond the default quota |
| `identity` | `chrome.identity.getAuthToken()` for Google OAuth |
| `downloads` | Save generated files directly to Downloads |

---

## Externally Connectable Origins

The following origins can use `chrome.runtime.sendMessage` to talk to the extension:

```json
"externally_connectable": {
  "matches": [
    "http://localhost:3000/*",
    "http://localhost:5173/*",
    "https://*.pixelmate.app/*"
  ]
}
```

If you host the PWA on a different origin, add it here and rebuild.

---

## Service Worker Lifecycle

Chrome MV3 service workers are not persistent — they wake on events and sleep after ~30 s of inactivity. Key implications:

- **Global state resets** between wakes. `toolRegistry` and `fileSystem` are re-initialized on `chrome.runtime.onInstalled` and on the first message after a sleep.
- **Long-running agent tasks** keep the service worker alive via an open `chrome.runtime.Port`.
- **OPFS** data is persistent across service worker restarts.

### Keeping the Worker Awake

The popup and PWA maintain a `chrome.runtime.Port` (`'agent'`) for the duration of an agent run. This keeps the service worker alive. Once `AGENT_COMPLETE` or `ERROR` is posted, the port is closed.

---

## Message Protocol

All one-shot messages flow through `chrome.runtime.sendMessage`. Streaming agent runs use a persistent `chrome.runtime.Port`.

See [API Reference](./api.md) for the full message protocol.

---

## Icons

Place icon files at:

```
packages/extension-v2/src/icons/
  icon16.png
  icon48.png
  icon128.png
```

Then update `packages/extension-v2/manifest.json`:

```json
"action": {
  "default_popup": "src/popup/index.html",
  "default_icon": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

Rebuild for changes to take effect.

---

## Debugging

### Service Worker Logs

1. Go to `chrome://extensions`
2. Click **Service Worker** under the PixelMate card
3. A DevTools window opens with the background page console

### Popup Logs

Right-click the popup → **Inspect** to open DevTools for the popup window.

### Content Script Logs

Open DevTools on any page → **Console** and look for `[PixelMate]` prefixed messages.

---

## Building for Production

```bash
pnpm --filter @pixelmate/extension run build
```

The `prepare-dist.mjs` script post-processes the build:

- Writes `dist/manifest.json` from the source manifest with the version from `package.json`
- Ensures icons directory is copied

Zip `dist/` and upload to the Chrome Web Store Developer Dashboard.
