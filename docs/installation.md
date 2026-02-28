# Installation Guide

PixelMate is a **Chrome Extension MV3** — there is no backend server to run.  
This guide covers loading the pre-built extension and building from source.

---

## System Requirements

| Component | Requirement |
|-----------|-------------|
| Browser | Chrome 112+ or any Chromium-based browser |
| OS | ChromeOS, Windows 10+, macOS 12+, Linux |
| Node.js | 20.x LTS (**only if building from source**) |
| pnpm | 9.x (**only if building from source**) |

---

## API Keys

You need at least one LLM provider API key. Keys are entered via the extension's **Settings** UI — no `.env` file needed.

| Provider | Default Model | Get API Key |
|----------|--------------|-------------|
| Anthropic | `claude-sonnet-4` | https://console.anthropic.com |
| OpenAI | `gpt-4o` | https://platform.openai.com/api-keys |
| Groq | `llama-3.3-70b-versatile` | https://console.groq.com |

---

## Method 1 — Load Unpacked (Development)

### 1. Clone and build

```bash
git clone https://github.com/pixelmate/pixelmate.git
cd pixelmate
pnpm install
pnpm run build
```

### 2. Load in Chrome

1. Navigate to `chrome://extensions`
2. Enable the **Developer mode** toggle (top right)
3. Click **Load unpacked**
4. Select the folder `packages/extension-v2/dist`

The PixelMate icon appears in the Chrome toolbar.

### 3. Configure API key

1. Click the PixelMate icon
2. Go to **Settings → AI Provider**
3. Choose your provider, select a model, then paste your API key and click **Save Key**

---

## Method 2 — Chrome Web Store *(coming soon)*

The extension will be available on the Chrome Web Store. Once published, one-click install will be available.

---

## Building from Source — Detail

### Prerequisites

```bash
# Install pnpm if not already installed
npm install -g pnpm@9

# Verify
node --version   # should be 20.x
pnpm --version   # should be 9.x
```

### Workspace layout

```
pixelmate/
├── packages/
│   ├── shared/          # @pixelmate/shared — TypeScript types
│   ├── core/            # @pixelmate/core   — Agent, tools, providers, skills
│   ├── extension-v2/    # @pixelmate/extension — Chrome Extension MV3
│   └── frontend/        # @pixelmate/frontend — React 18 + Vite PWA
└── pnpm-workspace.yaml
```

### Build commands

```bash
# Build all packages
pnpm run build

# Build a single package
pnpm --filter @pixelmate/core run build
pnpm --filter @pixelmate/extension run build
pnpm --filter @pixelmate/frontend run build

# Run tests
pnpm run test

# Development (hot-reload PWA frontend only)
pnpm --filter @pixelmate/frontend dev
```

### Output

After `pnpm run build`, the loadable extension is at:

```
packages/extension-v2/dist/
├── manifest.json
├── background.js       ← service worker
├── content.js          ← content script
├── popup.html          ← extension popup
├── popup.js
└── assets/
    ├── index-*.css
    └── index-*.js      ← PWA bundle (served from popup)
```

---

## Updating

```bash
git pull
pnpm install
pnpm run build
```

Then refresh the extension at `chrome://extensions` (click the reload ↺ icon next to PixelMate).

---

## API Keys

You need at least one LLM provider API key:

| Provider | Required | Getting API Key |
|----------|----------|-----------------|
| OpenAI | Recommended | https://platform.openai.com/api-keys |
| Anthropic | Recommended | https://console.anthropic.com |
| Groq | Optional | https://console.groq.com |
| Google | Optional | https://aistudio.google.com/app/apikey |
| Ollama | Optional | https://ollama.ai (local) |

---

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/pixelmate/pixelmate.git
cd pixelmate
```

### 2. Install Dependencies

```bash
npm install
```

This installs all dependencies for both backend and frontend packages.

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your preferred editor:

```bash
# Required: At least one LLM provider
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional: Additional providers
GROQ_API_KEY=gsk_...
GOOGLE_API_KEY=AI...
OLLAMA_BASE_URL=http://localhost:11434

# Server Configuration
PORT=3001
WORKING_DIRECTORY=./workspace
NODE_ENV=development
```

### 4. Start the Backend

```bash
npm run dev:backend
```

The backend server starts on http://localhost:3001

Expected output:
```
╔═══════════════════════════════════════════════════════════╗
║                    PixelMate Server                        ║
║                                                           ║
║  HTTP Server:  http://localhost:3001                      ║
║  WebSocket:    ws://localhost:3001/ws                    ║
║                                                           ║
║  Available tools: 30+                                     ║
║  Working dir:  ./workspace                                ║
╚═══════════════════════════════════════════════════════════╝
```

### 5. Start the Frontend

In a new terminal window:

```bash
npm run dev:frontend
```

The frontend development server starts on http://localhost:3000

### 6. Open PixelMate

Open http://localhost:3000 in your browser.

---

## Installation Methods

### Development Installation

For local development with hot reload:

```bash
# Install dependencies
npm install

# Start both servers concurrently
npm run dev
```

### Production Installation

For production deployment:

```bash
# Build both packages
npm run build

# Start the production server
npm start
```

### Docker Installation

```bash
# Build the image
docker build -t pixelmate .

# Run the container
docker run -p 3001:3001 -v $(pwd)/workspace:/app/workspace pixelmate
```

---

## Verifying Installation

### Check Backend Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-26T12:00:00.000Z"
}
```

### Check Available Tools

```bash
curl http://localhost:3001/api/tools
```

### Check WebSocket Connection

Open browser DevTools → Network tab → WS filter, then:
1. Connect to ws://localhost:3001/ws
2. Send: `{"type": "ping"}`
3. Expect: `{"type":"pong"}`

---

## Troubleshooting Installation

### Port Already in Use

If you get `EADDRINUSE` error:

```bash
# Find the process using the port
lsof -i :3001
# or
netstat -ano | findstr :3001

# Kill the process
kill -9 <PID>
```

Or change the port in `.env`:
```bash
PORT=3002
```

### Node Version Mismatch

Check your Node version:
```bash
node --version
```

Use nvm to switch versions:
```bash
nvm use 20
# or
nvm install 20
```

### Module Not Found Errors

Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Permission Errors (Linux/macOS)

```bash
sudo chown -R $(whoami) ~/.npm
npm cache clean --force
npm install
```

---

## Next Steps

- [Quick Start Guide](./quickstart.md) - Get started with your first task
- [Configuration](./configuration.md) - Customize PixelMate settings
- [Tools Reference](./tools.md) - Learn about available tools
