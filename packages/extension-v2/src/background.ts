/**
 * PixelMate Chrome Extension service worker
 * Runs the core agent logic using Chrome APIs
 */

import { Agent, ToolRegistry, AnthropicProvider, OpenAIProvider } from '@pixelmate/core';
import {
  ReadFileTool,
  WriteFileTool,
  ListDirectoryTool,
  CreateDirectoryTool,
  DeleteFileTool,
  MoveFileTool,
  CopyFileTool,
  HybridFileSystem
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
  
  // Browser tools are implemented via content script communication
  // We'll add those tool definitions but route them through content script messaging
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
        const { prompt, model, provider } = message;
        const result = await executeAgent(prompt, model, provider);
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
        const { prompt, model, provider } = message;
        await executeAgentWithStream(prompt, model, provider, port);
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

async function executeAgent(prompt: string, model?: string, provider?: string): Promise<string> {
  const llmProvider = await getProvider(provider);
  const agent = new Agent(llmProvider, toolRegistry, { model });
  
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
  port: chrome.runtime.Port
): Promise<void> {
  const llmProvider = await getProvider(provider);
  const agent = new Agent(llmProvider, toolRegistry, { model });
  
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
