# PixelMate

An AI agent that works in your browser and local files, inspired by Claude CoWork and OpenClaw.

## Features

- 🤖 AI-powered agent that can accomplish tasks autonomously
- 📁 File system tools (read, write, organize files)
- 🌐 Browser automation (navigate, click, fill forms)
- 🔌 Multiple LLM provider support (OpenAI, Anthropic, Groq, Google, Ollama)
- 📱 PWA - installable as a web app
- ⚡ Real-time updates via WebSocket

## Quick Start

### 1. Install Dependencies

```bash
cd pixelmate
npm install
```

### 2. Configure API Keys

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

Required variables:
- `ANTHROPIC_API_KEY` - For Claude models
- `OPENAI_API_KEY` - For GPT models
- `GROQ_API_KEY` - For Groq models (optional)

### 3. Start the Backend

```bash
npm run dev:backend
```

The backend will start on http://localhost:3001

### 4. Start the Frontend

In a new terminal:

```bash
npm run dev:frontend
```

The frontend will start on http://localhost:3000

### 5. Open PixelMate

Open http://localhost:3000 in your browser.

## Available Tools

### File System
- `read_file` - Read file contents
- `write_file` - Create or update files
- `list_directory` - List files in a directory
- `create_directory` - Create a new directory
- `delete_file` - Delete files or directories
- `move_file` - Move or rename files
- `copy_file` - Copy files or directories
- `glob` - Find files by pattern

### Browser
- `browser_navigate` - Navigate to a URL
- `browser_click` - Click elements
- `browser_fill` - Fill form inputs
- `browser_type` - Type with delays
- `browser_select` - Select dropdown options
- `browser_get_text` - Extract text
- `browser_get_html` - Extract HTML
- `browser_screenshot` - Take screenshots
- `browser_snapshot` - Get page info
- `browser_scroll` - Scroll pages
- `browser_wait` - Wait for elements

## Architecture

```
packages/
├── backend/          # Node.js server
│   └── src/
│       ├── agents/     # Agent core
│       ├── providers/  # LLM providers
│       ├── tools/      # Tool implementations
│       └── config/    # Configuration
└── frontend/         # React PWA
    └── src/
        └── App.tsx    # Main app
```

## Tech Stack

- **Backend**: Node.js, Express, WebSocket, TypeScript
- **Frontend**: React, Vite, PWA, TypeScript
- **AI**: LiteLLM-style abstraction (OpenAI, Anthropic)
- **Browser**: Playwright
- **Testing**: Vitest

## License

MIT
