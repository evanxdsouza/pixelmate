/**
 * PixelMate Chrome Extension service worker
 * Runs the core agent logic using Chrome APIs
 */

import { Agent, ToolRegistry, AnthropicProvider, OpenAIProvider, GroqProvider, getSkillPrompt } from '@pixelmate/core';
import {
  // Filesystem
  ReadFileTool,
  WriteFileTool,
  ListDirectoryTool,
  CreateDirectoryTool,
  DeleteFileTool,
  MoveFileTool,
  CopyFileTool,
  HybridFileSystem,
  // Browser automation
  BrowserNavigateTool,
  BrowserClickTool,
  BrowserFillTool,
  BrowserTypeTool,
  BrowserSelectTool,
  BrowserGetTextTool,
  BrowserGetHTMLTool,
  BrowserScreenshotTool,
  BrowserScrollTool,
  BrowserWaitTool,
  // Documents
  CreateDocumentTool,
  ConvertToDocumentTool,
  // Spreadsheets
  CreateSpreadsheetTool,
  ReadSpreadsheetTool,
  CreateCSVTool,
  ReadCSVTool,
  // Presentations
  CreatePresentationTool,
  CreateSlidesFromOutlineTool,
  // Formatters
  FormatAsJSONTool,
  FormatAsMarkdownTool,
  ParseJSONTool,
  ConvertBetweenFormatsTool,
  // Web search
  WebSearchTool,
  FetchWebPageTool,
  ResearchTopicTool
} from '@pixelmate/core';
import { getApiKey, getChromeStorage } from '@pixelmate/core';
import { LLMProvider } from '@pixelmate/shared';

// Global state
let toolRegistry = new ToolRegistry();
let fileSystem = new HybridFileSystem();
let currentAgent: Agent | null = null;
let activeConnections: Set<chrome.runtime.Port> = new Set();

// Initialize filesystem and tools on extension installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('PixelMate extension installed');
  await fileSystem.initializeOPFS();
  await initializeToolRegistry();
});

// Initialize tool registry
async function initializeToolRegistry(): Promise<void> {
  const fs = fileSystem;
  
  // Register filesystem tools
  toolRegistry.register(new ReadFileTool(fs));
  toolRegistry.register(new WriteFileTool(fs));
  toolRegistry.register(new ListDirectoryTool(fs));
  toolRegistry.register(new CreateDirectoryTool(fs));
  toolRegistry.register(new DeleteFileTool(fs));
  toolRegistry.register(new MoveFileTool(fs));
  toolRegistry.register(new CopyFileTool(fs));
  
  // Register browser automation tools
  toolRegistry.register(new BrowserNavigateTool());
  toolRegistry.register(new BrowserClickTool());
  toolRegistry.register(new BrowserFillTool());
  toolRegistry.register(new BrowserTypeTool());
  toolRegistry.register(new BrowserSelectTool());
  toolRegistry.register(new BrowserGetTextTool());
  toolRegistry.register(new BrowserGetHTMLTool());
  toolRegistry.register(new BrowserScreenshotTool());
  toolRegistry.register(new BrowserScrollTool());
  toolRegistry.register(new BrowserWaitTool());
  
  // Register document tools
  toolRegistry.register(new CreateDocumentTool(fs));
  toolRegistry.register(new ConvertToDocumentTool(fs));
  
  // Register spreadsheet tools
  toolRegistry.register(new CreateSpreadsheetTool(fs));
  toolRegistry.register(new ReadSpreadsheetTool(fs));
  toolRegistry.register(new CreateCSVTool(fs));
  toolRegistry.register(new ReadCSVTool(fs));
  
  // Register presentation tools
  toolRegistry.register(new CreatePresentationTool(fs));
  toolRegistry.register(new CreateSlidesFromOutlineTool(fs));
  
  // Register formatter tools
  toolRegistry.register(new FormatAsJSONTool());
  toolRegistry.register(new FormatAsMarkdownTool());
  toolRegistry.register(new ParseJSONTool());
  toolRegistry.register(new ConvertBetweenFormatsTool());
  
  // Register web search tools
  toolRegistry.register(new WebSearchTool());
  toolRegistry.register(new FetchWebPageTool());
  toolRegistry.register(new ResearchTopicTool());
  
  console.log(`Initialized ${toolRegistry.getAll().length} tools in registry`);
}

// Get LLM provider based on config
async function getProvider(providerName?: string): Promise<LLMProvider> {
  const provider = providerName || 'anthropic';
  const apiKey = await getApiKey(provider);
  
  if (!apiKey) {
    throw new Error(`API key not found for provider: ${provider}`);
  }
  
  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'groq':
      return new GroqProvider(apiKey);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// Handle messages from popup and PWA
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message, sendResponse);
  return true; // Keep channel open for async
});

// Handle persistent connections from popup
chrome.runtime.onConnect.addListener((port) => {
  activeConnections.add(port);
  
  port.onMessage.addListener((message) => {
    handlePortMessage(message, port);
  });
  
  port.onDisconnect.addListener(() => {
    activeConnections.delete(port);
  });
});

async function handleMessage(message: Record<string, any>, sendResponse: Function): Promise<void> {
  try {
    switch (message.type) {
      case 'AGENT_EXECUTE': {
        const { prompt, model, provider, skill } = message;
        const result = await executeAgent(prompt, model, provider, skill);
        sendResponse({ success: true, result });
        break;
      }
      
      case 'SET_API_KEY': {
        const { provider, apiKey } = message;
        await chrome.storage.sync.set({ [`api_key:${provider}`]: apiKey });
        sendResponse({ success: true });
        break;
      }
      
      case 'GET_CONFIG': {
        const { keys } = message;
        const values = await getChromeStorage(keys);
        sendResponse({ success: true, values });
        break;
      }
      
      case 'REQUEST_FILE_ACCESS': {
        await fileSystem.requestNativeAccess();
        sendResponse({ success: true });
        break;
      }
      
      case 'INIT_GOOGLE_DRIVE': {
        const { accessToken } = message;
        await fileSystem.initializeGoogleDrive(accessToken);
        sendResponse({ success: true });
        break;
      }
      
      case 'GET_TOOLS': {
        const tools = toolRegistry.getDefinitions();
        sendResponse({ success: true, tools });
        break;
      }

      case 'GOOGLE_AUTH': {
        // Request Google OAuth token using chrome.identity
        // Scopes cover Drive, Sheets, Docs, Slides, Gmail read
        const GOOGLE_SCOPES = [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/documents',
          'https://www.googleapis.com/auth/presentations',
          'https://www.googleapis.com/auth/gmail.readonly'
        ];

        try {
          // Try the Chrome extension identity flow first (works on Chromebook)
          const token = await new Promise<string>((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true, scopes: GOOGLE_SCOPES }, (token) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else if (token) {
                resolve(token);
              } else {
                reject(new Error('No token returned'));
              }
            });
          });

          // Wire Google Drive into the filesystem
          await fileSystem.initializeGoogleDrive(token);
          await chrome.storage.session.set({ google_access_token: token });

          sendResponse({ success: true, token });
        } catch (err) {
          sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
        break;
      }

      case 'GOOGLE_SIGNOUT': {
        // Revoke and remove cached token
        const cached = await chrome.storage.session.get('google_access_token');
        if (cached.google_access_token) {
          chrome.identity.removeCachedAuthToken({ token: cached.google_access_token });
          await chrome.storage.session.remove('google_access_token');
        }
        sendResponse({ success: true });
        break;
      }

      case 'GET_SESSIONS': {
        // Return recent conversation sessions from chrome.storage.local
        const stored = await chrome.storage.local.get('sessions');
        const sessions: Array<{ id: string; title: string; createdAt: string }> = stored.sessions || [];
        sendResponse({ success: true, sessions: sessions.slice(0, 10) });
        break;
      }

      case 'SAVE_SESSION': {
        const { session } = message;
        const stored = await chrome.storage.local.get('sessions');
        const sessions: Array<Record<string, unknown>> = stored.sessions || [];
        const idx = sessions.findIndex((s) => s.id === session.id);
        if (idx >= 0) {
          sessions[idx] = session;
        } else {
          sessions.unshift(session);
        }
        await chrome.storage.local.set({ sessions: sessions.slice(0, 50) });
        sendResponse({ success: true });
        break;
      }

      case 'GET_FILES': {
        try {
          const names = await fileSystem.listFiles('/');
          const entries = names.map((name: string) => ({
            name: name.replace(/\/$/, ''),
            type: name.endsWith('/') ? 'directory' : 'file',
          }));
          sendResponse({ success: true, files: entries });
        } catch (err) {
          sendResponse({ success: false, error: err instanceof Error ? err.message : String(err), files: [] });
        }
        break;
      }
      
      default:
        sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
    }
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}

async function handlePortMessage(message: Record<string, any>, port: chrome.runtime.Port): Promise<void> {
  try {
    switch (message.type) {
      case 'AGENT_EXECUTE': {
        const { prompt, model, provider, skill } = message;
        await executeAgentWithStream(prompt, model, provider, port, skill);
        break;
      }
    }
  } catch (error) {
    port.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function executeAgent(prompt: string, model?: string, provider?: string, skill?: string): Promise<string> {
  const llmProvider = await getProvider(provider);
  const systemPrompt = skill ? getSkillPrompt(skill) : undefined;
  const agent = new Agent(llmProvider, toolRegistry, { model, systemPrompt });
  
  return new Promise((resolve, reject) => {
    agent.onEvent((event) => {
      console.log('Agent event:', event);
    });
    
    agent.run(prompt, model).then(resolve).catch(reject);
  });
}

async function executeAgentWithStream(
  prompt: string,
  model: string | undefined,
  provider: string | undefined,
  port: chrome.runtime.Port,
  skill?: string
): Promise<void> {
  const llmProvider = await getProvider(provider);
  const systemPrompt = skill ? getSkillPrompt(skill) : undefined;
  const agent = new Agent(llmProvider, toolRegistry, { model, systemPrompt });
  
  agent.onEvent((event) => {
    port.postMessage({
      type: 'AGENT_EVENT',
      event
    });
  });
  
  const result = await agent.run(prompt, model);
  port.postMessage({
    type: 'AGENT_COMPLETE',
    result
  });
}

// Take screenshot via chrome.tabs API
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TAKE_SCREENSHOT' && sender.tab?.id) {
    chrome.tabs.captureVisibleTab(sender.tab.windowId!, async (dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true;
  }
});

console.log('PixelMate service worker initialized');
