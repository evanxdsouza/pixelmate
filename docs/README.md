# PixelMate Documentation

Welcome to the PixelMate documentation. PixelMate is a browser-native AI agent that runs as a **Chrome Extension** (MV3) with an optional **PWA** frontend — no backend server required.

---

## Table of Contents

### Getting Started
- [Installation Guide](./installation.md) — Load the extension and build from source
- [Quick Start](./quickstart.md) — Accomplish your first task in 5 minutes
- [Configuration](./configuration.md) — API keys, providers, and model selection

### User Guide
- [User Interface](./ui-guide.md) — Chat, Files, Tools, and Settings views
- [Available Tools](./tools.md) — Complete reference for all 38+ tools
- [Skills](./skills.md) — Built-in skills for common tasks
- [Security](./security.md) — Confirmation system and danger levels

### Developer Guide
- [Architecture](./architecture.md) — Chrome Extension + PWA + Core package design
- [API Reference](./api.md) — ExtensionBridge message API
- [Tool Development](./tool-development.md) — Creating custom tools
- [Skill Development](./skill-development.md) — Creating custom skills
- [Provider Integration](./providers.md) — Supported LLM providers and models

### Advanced Topics
- [Chrome Extension](./chrome-extension.md) — Loading, permissions, and side-panel usage
- [PWA Installation](./pwa.md) — Installing as a desktop app on Chromebook / Chrome
- [Troubleshooting](./troubleshooting.md) — Common issues and solutions
- [Contributing](./contributing.md) — Development setup and contribution guide

---

## What is PixelMate?

PixelMate is an AI-powered personal assistant built as a **Chrome Extension MV3 service worker**. It runs entirely inside your browser — no Node.js server, no cloud relay.

The optional **PWA frontend** (React + Vite) communicates with the extension via `chrome.runtime` messaging (`ExtensionBridge`). This means all LLM calls, file operations, and browser automations happen inside the extension, with your API keys stored in `chrome.storage.sync`.

### Key Features

| Feature | Detail |
|---------|--------|
| **No Server** | Extension service worker replaces the backend |
| **Multi-Provider** | Anthropic, OpenAI, Groq — selectable per session |
| **Model Selection** | Pick any model for your chosen provider |
| **38+ Tools** | File system, browser automation, documents, web search |
| **6 Skills** | Document, Email, Presentation, Spreadsheet, Research, Code |
| **Google Workspace** | OAuth via `chrome.identity`, Drive/Docs/Sheets/Slides |
| **Hybrid Filesystem** | OPFS + Google Drive + Native File System Access API |
| **PWA** | Installable on Chromebook or any Chrome browser |

### Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@pixelmate/shared` | `packages/shared` | TypeScript types & interfaces |
| `@pixelmate/core` | `packages/core` | Agent, ToolRegistry, Providers, Skills |
| `@pixelmate/extension` | `packages/extension-v2` | Chrome Extension MV3 service worker |
| `@pixelmate/frontend` | `packages/frontend` | React 18 + Vite PWA |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | Feb 2026 | Chrome Extension MV3, 38+ tools, 3 providers, model selection, Google OAuth |

---

## Getting Help

- **Issues**: https://github.com/pixelmate/pixelmate/issues
- **Discussions**: https://github.com/pixelmate/pixelmate/discussions

---

*Last updated: February 2026*
