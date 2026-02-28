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
  ResearchTopicTool,
  // Google Workspace
  GoogleDocsCreateTool,
  GoogleDocsReadTool,
  GoogleDocsAppendTool,
  GoogleSheetsCreateTool,
  GoogleSheetsReadTool,
  GoogleSheetsWriteTool,
  GoogleSlidesCreateTool,
  GoogleSlidesReadTool,
  // Gmail
  GmailListTool,
  GmailReadTool,
  GmailSearchTool,
  GmailSendTool,
  GmailReplyTool,
} from '@pixelmate/core';
import { getApiKey, getChromeStorage } from '@pixelmate/core';
import { LLMProvider } from '@pixelmate/shared';

// Global state
let toolRegistry = new ToolRegistry();
let fileSystem = new HybridFileSystem();
let currentAgent: Agent | null = null;
let activeConnections: Set<chrome.runtime.Port> = new Set();

// Pending confirmation callbacks keyed by confirmId (H1 fix)
const pendingConfirmations = new Map<string, (approved: boolean) => void>();

// Rate limiting: max 10 AGENT_EXECUTE calls per port per minute (H4 fix)
const rateLimitMap = new Map<chrome.runtime.Port, { count: number; resetAt: number }>();
const RATE_LIMIT_COUNT = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Origins allowed to communicate externally via externally_connectable (C1 fix)
const ALLOWED_EXTERNAL_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  'https://pixelmate.app',
]);

// Only these non-secret keys may be read via GET_CONFIG by external callers (C2 fix)
const CONFIG_SAFE_KEYS = new Set(['selected_provider', 'selected_model', 'theme', 'language']);

/** Only trust messages from our own extension or the known PWA origins. */
function isMessageTrusted(sender: chrome.runtime.MessageSender): boolean {
  // Internal: content scripts and extension pages all carry our extension ID
  if (sender.id === chrome.runtime.id) return true;
  // External: externally_connectable pages — validate origin explicitly
  if (sender.origin && ALLOWED_EXTERNAL_ORIGINS.has(sender.origin)) return true;
  return false;
}

/** Simple sliding-window rate limiter per port. Returns false when limit exceeded. */
function checkRateLimit(port: chrome.runtime.Port): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(port);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }
  if (entry.count >= RATE_LIMIT_COUNT) return false;
  entry.count++;
  rateLimitMap.set(port, entry);
  return true;
}

// Returns the Google OAuth token stored from the last sign-in.
// Passed to all Google Workspace / Gmail tools so they can make authenticated API calls.
const getGoogleToken = async (): Promise<string | null> => {
  const stored = await chrome.storage.session.get('google_access_token');
  return (stored.google_access_token as string | null) ?? null;
};

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

  // Register Google Workspace tools (Docs, Sheets, Slides)
  toolRegistry.register(new GoogleDocsCreateTool(getGoogleToken));
  toolRegistry.register(new GoogleDocsReadTool(getGoogleToken));
  toolRegistry.register(new GoogleDocsAppendTool(getGoogleToken));
  toolRegistry.register(new GoogleSheetsCreateTool(getGoogleToken));
  toolRegistry.register(new GoogleSheetsReadTool(getGoogleToken));
  toolRegistry.register(new GoogleSheetsWriteTool(getGoogleToken));
  toolRegistry.register(new GoogleSlidesCreateTool(getGoogleToken));
  toolRegistry.register(new GoogleSlidesReadTool(getGoogleToken));

  // Register Gmail tools
  toolRegistry.register(new GmailListTool(getGoogleToken));
  toolRegistry.register(new GmailReadTool(getGoogleToken));
  toolRegistry.register(new GmailSearchTool(getGoogleToken));
  toolRegistry.register(new GmailSendTool(getGoogleToken));
  toolRegistry.register(new GmailReplyTool(getGoogleToken));

  console.log(`Initialized ${toolRegistry.getAll().length} tools in registry`);
}

// Static model lists used as fallbacks when the live API call fails
// or when no API key is set yet.
const STATIC_MODELS: Record<string, string[]> = {
  anthropic: [
    'claude-opus-4-1',
    'claude-sonnet-4',
    'claude-haiku-3',
    'claude-3.5-sonnet',
    'claude-3-haiku',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ],
};

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

// Handle messages from popup and PWA (single consolidated listener — L1 fix)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Reject messages from untrusted origins (C1 fix)
  if (!isMessageTrusted(sender)) {
    sendResponse({ success: false, error: 'Untrusted sender' });
    return false;
  }
  handleMessage(message, sender, sendResponse);
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

async function handleMessage(
  message: Record<string, any>,
  sender: chrome.runtime.MessageSender,
  sendResponse: Function
): Promise<void> {
  try {
    switch (message.type) {
      case 'AGENT_EXECUTE': {
        const { prompt, model, provider, skill } = message;
        const result = await executeAgent(prompt, model, provider, skill);
        sendResponse({ success: true, result });
        break;
      }
      
      case 'SET_API_KEY': {
        // API keys stored in local (not sync) so they never leave the device (C3 fix)
        const { provider, apiKey } = message;
        await chrome.storage.local.set({ [`api_key:${provider}`]: apiKey });
        sendResponse({ success: true });
        break;
      }
      
      case 'GET_CONFIG': {
        // Only expose non-secret preference keys — never api_key:* (C2 fix)
        const requestedKeys: string[] = Array.isArray(message.keys) ? message.keys : [];
        const safe = requestedKeys.filter(k => CONFIG_SAFE_KEYS.has(k));
        if (safe.length !== requestedKeys.length) {
          sendResponse({ success: false, error: 'One or more requested config keys are not permitted' });
          break;
        }
        const values = await getChromeStorage(safe);
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
        // gmail.send is NOT included by default — request it lazily via GOOGLE_AUTH_GMAIL_SEND (L2 fix)
        const GOOGLE_SCOPES = [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/documents',
          'https://www.googleapis.com/auth/presentations',
          'https://www.googleapis.com/auth/gmail.readonly',
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
        // Return recent sessions, pruning those older than 30 days (M4 fix)
        const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
        const stored = await chrome.storage.local.get('sessions');
        const allSessions: Array<{ id: string; title: string; createdAt: string; savedAt?: number }> = stored.sessions || [];
        const now = Date.now();
        const sessions = allSessions.filter(s => !s.savedAt || (now - s.savedAt) < SESSION_TTL_MS);
        sendResponse({ success: true, sessions: sessions.slice(0, 10) });
        break;
      }

      case 'SAVE_SESSION': {
        const { session } = message;
        const stored = await chrome.storage.local.get('sessions');
        const sessions: Array<Record<string, unknown>> = stored.sessions || [];
        const idx = sessions.findIndex((s) => s.id === session.id);
        const withTimestamp = { ...session, savedAt: Date.now() };
        if (idx >= 0) {
          sessions[idx] = withTimestamp;
        } else {
          sessions.unshift(withTimestamp);
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

      case 'GET_MODELS': {
        const prov: string = message.provider || 'anthropic';
        const fallback = STATIC_MODELS[prov] ?? [];
        try {
          // Try live list — requires a valid API key already saved
          const llmProvider = await getProvider(prov);
          const liveModels = await llmProvider.listModels();
          sendResponse({ success: true, models: liveModels.length > 0 ? liveModels : fallback });
        } catch {
          // No API key yet or network error — return static list so UI still works
          sendResponse({ success: true, models: fallback });
        }
        break;
      }

      case 'SET_PROVIDER': {
        const { provider: prov, model: mod } = message;
        const data: Record<string, string> = { selected_provider: prov };
        if (mod !== undefined && mod !== '') data.selected_model = mod;
        await chrome.storage.sync.set(data);
        sendResponse({ success: true });
        break;
      }

      // Lazily request gmail.send scope when the user first tries to send email (L2 fix)
      case 'GOOGLE_AUTH_GMAIL_SEND': {
        const SEND_SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
        try {
          const token = await new Promise<string>((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true, scopes: SEND_SCOPES }, (t) => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else if (t) resolve(t);
              else reject(new Error('No token returned'));
            });
          });
          await chrome.storage.session.set({ google_send_token: token });
          sendResponse({ success: true });
        } catch (err) {
          sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
        break;
      }

      // Screenshot: only valid when called from a tab context (L1 / consolidated listener)
      case 'TAKE_SCREENSHOT': {
        if (!sender.tab?.id) {
          sendResponse({ error: 'TAKE_SCREENSHOT must be sent from a tab context' });
          break;
        }
        chrome.tabs.captureVisibleTab(sender.tab.windowId!, (dataUrl) => {
          sendResponse({ dataUrl });
        });
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
        // Enforce rate limit before running the agent (H4 fix)
        if (!checkRateLimit(port)) {
          port.postMessage({ type: 'ERROR', error: 'Rate limit exceeded — max 10 agent calls per minute.' });
          break;
        }
        const { prompt, model, provider, skill } = message;
        await executeAgentWithStream(prompt, model, provider, port, skill);
        break;
      }

      // Frontend sends this in response to a CONFIRM_REQUIRED event (H1 fix)
      case 'CONFIRM_RESPONSE': {
        const { confirmId, approved } = message;
        const resolver = pendingConfirmations.get(confirmId as string);
        if (resolver) {
          resolver(Boolean(approved));
          pendingConfirmations.delete(confirmId as string);
        }
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

  // Wire up user-facing confirmation for destructive tools (H1 fix)
  // Look up metadata so the frontend can show an informative dialog
  const TOOL_DANGER: Record<string, { level: string; description: string }> = {
    delete_file:     { level: 'critical', description: 'Delete a file or directory permanently' },
    move_file:       { level: 'high',     description: 'Move or rename a file' },
    write_file:      { level: 'medium',   description: 'Write content to a file' },
    browser_navigate:{ level: 'high',     description: 'Navigate to a URL in the browser' },
    browser_fill:    { level: 'medium',   description: 'Fill a form field with data' },
    browser_click:   { level: 'medium',   description: 'Click an element on the page' },
    gmail_send:      { level: 'high',     description: 'Send an email on your behalf' },
    gmail_reply:     { level: 'high',     description: 'Reply to an email on your behalf' },
  };
  const confirmationHandler = (toolName: string, params: Record<string, unknown>): Promise<boolean> => {
    return new Promise((resolve) => {
      const confirmId = `confirm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pendingConfirmations.set(confirmId, resolve);
      const meta = TOOL_DANGER[toolName] ?? { level: 'medium', description: `Run tool: ${toolName}` };
      port.postMessage({ type: 'CONFIRM_REQUIRED', confirmId, toolName, params, dangerLevel: meta.level, description: meta.description });
      // Auto-deny after 60 s if no response to avoid hanging the agent
      setTimeout(() => {
        if (pendingConfirmations.has(confirmId)) {
          pendingConfirmations.delete(confirmId);
          resolve(false);
        }
      }, 60_000);
    });
  };

  const agent = new Agent(llmProvider, toolRegistry, { model, systemPrompt, confirmationHandler });
  
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

console.log('PixelMate service worker initialized');
