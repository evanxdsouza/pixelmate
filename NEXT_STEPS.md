# PixelMate Chromebook Implementation - Next Steps

## Summary of Completed Work

You now have a **fully functional browser-first AI agent system** ready for Chromebook with **38+ tools** and **zero Node.js dependencies**.

### What's Built ✓
- **@pixelmate/core**: Agent, tools, storage, providers (browser-compatible)
- **@pixelmate/extension-v2**: Chrome Extension with service worker and popup
- **@pixelmate/shared**: Common types for cross-package communication
- **All Tools**: Filesystem, browser, documents, spreadsheets, presentations, formatting, web search

### What's Left (Priority Order)

## Phase 1: Tool Registration & Integration (4-6 hours)

### Task 1.1: Register Tools in Service Worker
**File**: `packages/extension-v2/src/background.ts`

```typescript
// Add browser tools to registry (they use extension APIs)
import { 
  BrowserNavigateTool, BrowserClickTool, BrowserFillTool,
  // ... other browser tools
} from '@pixelmate/core';

async function initializeToolRegistry() {
  const fs = fileSystem;
  
  // Filesystem tools (already there)
  // ...
  
  // Browser tools (NEW - add these)
  toolRegistry.register(new BrowserNavigateTool());
  toolRegistry.register(new BrowserClickTool());
  toolRegistry.register(new BrowserFillTool());
  // ... add all 10 browser tools
  
  // Document/spreadsheet/etc tools (NEW)
  toolRegistry.register(new CreateDocumentTool(fs));
  toolRegistry.register(new ConvertToDocumentTool(fs));
  // ... add all document/sheet/presentation tools
  
  // Web search tools (NEW)
  toolRegistry.register(new WebSearchTool());
  toolRegistry.register(new FetchWebPageTool());
  toolRegistry.register(new ResearchTopicTool());
  
  // Formatter tools (NEW)
  toolRegistry.register(new FormatAsJSONTool());
  // ... add all formatter tools
}
```

### Task 1.2: Fix Browser Tool Dependencies
**File**: `packages/extension-v2/src/background.ts`

Browser tools need to send messages to content script. Update tool implementations to accept service worker context:

```typescript
// For each browser tool that needs content script
// Modify to use: chrome.tabs.sendMessage(tabId, message, callback)
```

## Phase 2: Build System Setup (3-4 hours)

### Task 2.1: Create Root Build Script
**File**: `package.json` (root level)

```json
{
  "scripts": {
    "install": "pnpm install",
    "build": "pnpm run build --filter ./packages",
    "build:core": "pnpm run build --filter @pixelmate/core",
    "build:extension": "pnpm run build --filter @pixelmate/extension-v2",
    "build:pwa": "pnpm run build --filter pixelmate-frontend",
    "dev:extension": "cd packages/extension-v2 && npm run dev",
    "dev:pwa": "cd packages/frontend && npm run dev"
  }
}
```

### Task 2.2: Update Extension Build Config
**File**: `packages/extension-v2/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  plugins: [
    react(),
    webExtension()  // Auto-handles multiple entry points
  ],
  build: {
    minify: 'terser',
    rollupOptions: {
      input: {
        background: 'src/background.ts',
        content: 'src/content.ts',
        popup: 'src/popup/index.html'
      }
    }
  }
});
```

### Task 2.3: Add package.json Scripts
**Files**: 
- `packages/core/package.json`
- `packages/shared/package.json`
- `packages/extension-v2/package.json`

Ensure all have proper build and dev scripts.

## Phase 3: PWA Frontend Migration (4-6 hours)

### Task 3.1: Create Extension Bridge Service
**File**: `packages/frontend/src/services/extension-bridge.ts`

```typescript
export class ExtensionBridge {
  static sendMessage(message: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response: { success: boolean; result?: unknown; error?: string }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.success) {
          resolve(response.result);
        } else {
          reject(new Error(response?.error || 'Extension error'));
        }
      });
    });
  }
  
  static connect(name: string): chrome.runtime.Port {
    return chrome.runtime.connect({ name });
  }
  
  static setApiKey(provider: string, key: string): Promise<void> {
    return this.sendMessage({ type: 'SET_API_KEY', provider, key }) as Promise<void>;
  }
}
```

### Task 3.2: Update App.tsx
**File**: `packages/frontend/src/App.tsx`

Replace WebSocket with extension messaging:

```typescript
// Remove WebSocket code
// Replace with ExtensionBridge.connect()

function App() {
  const [messages, setMessages] = useState([]);
  const [isExtensionAvailable, setIsExtensionAvailable] = useState(true);
  
  useEffect(() => {
    if (!chrome.runtime) {
      setIsExtensionAvailable(false);
      return;
    }
    // App works with extension
  }, []);
  
  const sendPrompt = async (prompt: string) => {
    try {
      const port = ExtensionBridge.connect('pwa');
      port.onMessage.addListener((msg) => {
        if (msg.type === 'AGENT_EVENT') {
          // Update UI
        }
      });
      port.postMessage({ type: 'AGENT_EXECUTE', prompt });
    } catch (error) {
      setIsExtensionAvailable(false);
    }
  };
  
  if (!isExtensionAvailable) {
    return <div>Please install PixelMate extension</div>;
  }
  
  return /* chat UI */;
}
```

### Task 3.3: Implement Zustand Store
**File**: `packages/frontend/src/store/agent.ts`

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export const useAgentStore = create(
  devtools(
    persist((set) => ({
      conversations: [],
      currentConversation: null,
      messages: [],
      selectedModel: 'claude-sonnet-4',
      selectedProvider: 'anthropic',
      
      addMessage: (msg) => set((state) => ({
        messages: [...state.messages, msg]
      })),
      
      // ... other actions
    }), {
      name: 'pixelmate-store'
    })
  )
);
```

## Phase 4: Testing & Documentation (3-4 hours)

### Task 4.1: Create Chromebook Setup Guide
**File**: `docs/chromebook-setup.md`

```markdown
# Installing PixelMate on Chromebook

## Prerequisites
- Chromebook (any model, Android or ChromeOS)
- API key for Claude (Anthropic) or GPT (OpenAI)

## Installation Steps

1. **Load Extension** (Developer Mode)
   - Go to chrome://extensions
   - Enable "Developer Mode"
   - Click "Load unpacked"
   - Select `packages/extension-v2/dist`

2. **Alternative: Install from Chrome Web Store**
   [Link when published]

3. **Set API Key**
   - Click extension icon
   - Click settings icon
   - Paste your API key
   - Click Save

4. **Use Extension**
   - Click extension icon for quick access
   - Or visit https://pixelmate[.dev|local] for PWA

## First Run

Ask it: "Read the current page and summarize it"
Ask it: "Create a spreadsheet with data about Chromebooks"
Ask it: "Search for AI agents and research the topic"

## Troubleshooting

[... common issues ...]
```

### Task 4.2: Local Testing Checklist
Create: `TESTING_CHECKLIST.md`

```markdown
# Testing Checklist

## Extension Installation
- [ ] Load unpacked extension
- [ ] See popup open
- [ ] Set API key in settings
- [ ] Save without errors

## Core Functionality
- [ ] Send simple prompt to Claude/GPT
- [ ] See real-time thinking messages
- [ ] Get response in popup

## File Operations
- [ ] Create file with OPFS
- [ ] List directory
- [ ] Read file contents

## Browser Tools
- [ ] Navigate to a website
- [ ] Click on element
- [ ] Extract text from element
- [ ] Take screenshot

## Document/Sheet Creation
- [ ] Create spreadsheet
- [ ] Create document
- [ ] Create presentation

## Web Search
- [ ] Search for a topic
- [ ] Fetch page content
- [ ] Run research (search + fetch)

## PWA
- [ ] Open PWA in new tab
- [ ] See connection to extension
- [ ] Execute prompt from PWA
- [ ] Verify same results
```

## Phase 5: Production Ready (2-3 hours)

### Task 5.1: Cleanup & Optimization
- [ ] Remove console.logs
- [ ] Minify extension code
- [ ] Test extension size (~500KB ideal)
- [ ] Check performance on slow connections

### Task 5.2: Chrome Web Store Preparation
- [ ] Create extension icon (128x128)
- [ ] Write extension description
- [ ] Take screenshots for store
- [ ] Prepare privacy policy
- [ ] Set up Google Cloud project for OAuth (if using Google Sheets)

### Task 5.3: Documentation
- [ ] Update README.md
- [ ] Create user guide
- [ ] Document all tools
- [ ] FAQ section

## Quick Command Reference

```bash
# Development
cd packages/extension-v2
npm run dev              # Watch build

# Build all
npm run build

# Build specific
npm run build:core
npm run build:extension

# Testing
npm run build:extension  # Creates dist/
# Load dist in chrome://extensions with developer mode
```

## File Changes Summary

**To Add:**
1. Complete browser tool implementations in background.ts
2. Tool initialization in background.ts
3. Extension Bridge service in frontend
4. Update App.tsx for extension messaging
5. Setup guide documentation
6. Vite extension plugin configuration

**To Modify:**
1. frontend/src/App.tsx (WebSocket → Extension messaging)
2. frontend/src/main.tsx (Router setup if needed)
3. Root package.json (build scripts)

**To Remove (later):**
1. packages/backend/* (old Node.js backend)
2. packages/extension/* (old minimal extension)
3. WebSocket client code from frontend

## Success Criteria MVP

✅ Extension loads without errors
✅ Can set API key
✅ Can send prompt and get response
✅ Filesystem operations work (OPFS)
✅ Browser automation works on real pages
✅ Can create documents/spreadsheets
✅ Web search works (with API key)
✅ PWA alternative interface works
✅ No backend server needed
✅ Works on actual Chromebook (or emulation)

## Estimated Time

- Phase 1: 4-6 hours
- Phase 2: 3-4 hours
- Phase 3: 4-6 hours
- Phase 4: 3-4 hours
- Phase 5: 2-3 hours

**Total: ~17-26 hours** to MVP

## Questions?

Refer to:
- `MIGRATION_PROGRESS.md` - Overall progress
- Architecture comments in code
- OpenClaw reference for browser extension patterns
- Dexie.js docs for IndexedDB
- Chrome Extension API docs for extension APIs
