# Installation Guide

This guide covers all installation methods and prerequisites for PixelMate.

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 18.x | 20.x LTS |
| Memory (RAM) | 4 GB | 8 GB |
| Disk Space | 500 MB | 1 GB |
| Operating System | macOS 10.15+, Windows 10+, Linux | Latest |

### Required Software

1. **Node.js** - Download from https://nodejs.org
2. **npm** - Comes with Node.js
3. **Git** - For version control (optional)

### API Keys

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
