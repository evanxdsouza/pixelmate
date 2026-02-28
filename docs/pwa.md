# PWA Installation

PixelMate includes a **Progressive Web App** (PWA) built with React 18 + Vite 5. It connects to the Chrome extension over `chrome.runtime` messaging.

---

## Running in Development

```bash
pnpm install
pnpm --filter @pixelmate/frontend dev
```

Open `http://localhost:5173`. The PWA will show a yellow banner if the Chrome extension is not detected.

---

## Installing as a Desktop App

### On Chromebook (recommended)

1. Open Chrome and navigate to `http://localhost:5173` (dev) or your hosted URL
2. Click the **⊕** (install) icon in the address bar, or open Chrome menu → **Install PixelMate…**
3. The app opens in its own window without browser chrome
4. It appears in the Launcher alongside other apps

### On any Chrome/Edge desktop

Same as Chromebook — look for the install icon in the address bar.

### Hosted Build

```bash
pnpm --filter @pixelmate/frontend run build
```

Serve `packages/frontend/dist/` on any static host (e.g. Vercel, Cloudflare Pages, GitHub Pages).

For the extension to connect, the origin must be listed in `externally_connectable` in `manifest.json`. See [Chrome Extension](./chrome-extension.md#externally-connectable-origins).

---

## PWA Features

| Feature | Detail |
|---------|--------|
| **Service Worker** | Workbox `generateSW` — precaches all static assets |
| **Offline shell** | App shell loads from cache when offline |
| **Installable** | `manifest.webmanifest` with icons, theme color, `standalone` display |
| **No server required** | All AI/tool logic runs in the extension service worker |

---

## Connecting to the Extension

The `ExtensionBridge` class resolves the extension ID from three sources (in priority order):

1. `chrome.runtime.id` — when the page is hosted inside the extension itself
2. `window.__PIXELMATE_EXT_ID` — injected by the content script on supported origins
3. `import.meta.env.VITE_EXTENSION_ID` — build-time environment variable

To hard-code the extension ID for a hosted deployment:

```bash
# packages/frontend/.env.local
VITE_EXTENSION_ID=your-extension-id-here
```

Find your extension ID on `chrome://extensions`.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_EXTENSION_ID` | Extension ID for externally-hosted PWA deployments |

---

## Build Output

```
packages/frontend/dist/
  index.html
  assets/
    index-*.js    ← React app bundle
    index-*.css   ← Styles
  sw.js           ← Workbox service worker
  workbox-*.js
  manifest.webmanifest
```
