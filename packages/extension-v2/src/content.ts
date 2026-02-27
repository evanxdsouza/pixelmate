/**
 * Chrome Extension content script for DOM manipulation and browser interaction
 * This runs in the context of web pages and handles tool requests from the service worker
 */

import { Tool, ToolDefinition, ToolResult } from '@pixelmate/shared';

// Types for content script communication
interface ContentScriptMessage {
  type: 'EXECUTE_BROWSER_TOOL' | 'GET_PAGE_INFO';
  tool?: string;
  params?: Record<string, unknown>;
}

interface ContentScriptResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

// DOM manipulation helpers
function findElement(selector: string): HTMLElement | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

function findElements(selector: string): HTMLElement[] {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch {
    return [];
  }
}

// Tool implementations for browser automation
export async function executeBrowserNavigate(url: string): Promise<void> {
  window.location.href = url;
  // Wait for navigation
  await new Promise(resolve => setTimeout(resolve, 2000));
}

export async function executeBrowserClick(selector: string): Promise<void> {
  const element = findElement(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  (element as HTMLElement).click();
  await new Promise(resolve => setTimeout(resolve, 500));
}

export async function executeBrowserFill(selector: string, value: string): Promise<void> {
  const element = findElement(selector) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!element) throw new Error(`Element not found: ${selector}`);
  
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 300));
}

export async function executeBrowserType(selector: string, text: string): Promise<void> {
  const element = findElement(selector) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!element) throw new Error(`Element not found: ${selector}`);
  
  element.focus();
  for (const char of text) {
    element.value += char;
    element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function executeBrowserSelect(selector: string, value: string): Promise<void> {
  const element = findElement(selector) as HTMLSelectElement | null;
  if (!element) throw new Error(`Select element not found: ${selector}`);
  
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 300));
}

export async function executeBrowserGetText(selector: string): Promise<string> {
  const element = findElement(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return element.innerText || element.textContent || '';
}

export async function executeBrowserGetHTML(selector: string): Promise<string> {
  const element = findElement(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return element.innerHTML;
}

export async function executeBrowserScreenshot(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'TAKE_SCREENSHOT' },
      (response: { dataUrl?: string; error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.dataUrl || '');
        }
      }
    );
  });
}

export async function executeBrowserScroll(direction: 'up' | 'down', amount: number): Promise<void> {
  const scrollAmount = direction === 'down' ? amount : -amount;
  window.scrollBy(0, scrollAmount);
  await new Promise(resolve => setTimeout(resolve, 500));
}

export async function executeBrowserWait(selector: string, timeout: number = 5000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (findElement(selector)) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Element not found within timeout: ${selector}`);
}

export async function getPageInfo(): Promise<{ url: string; title: string; content: string }> {
  return {
    url: window.location.href,
    title: document.title,
    content: document.body.innerText
  };
}

// Message handler for service worker requests
chrome.runtime.onMessage.addListener((message: ContentScriptMessage, _sender, sendResponse: (response: ContentScriptResponse) => void) => {
  handleContentScriptMessage(message, sendResponse);
  return true; // Keep channel open for async response
});

async function handleContentScriptMessage(message: ContentScriptMessage, sendResponse: (response: ContentScriptResponse) => void): Promise<void> {
  try {
    switch (message.type) {
      case 'EXECUTE_BROWSER_TOOL': {
        const { tool, params } = message;
        if (!tool) throw new Error('Tool name required');
        
        const result = await executeBrowserTool(tool, params || {});
        sendResponse({ success: true, result });
        break;
      }
      
      case 'GET_PAGE_INFO': {
        const info = await getPageInfo();
        sendResponse({ success: true, result: info });
        break;
      }
      
      default:
        sendResponse({ success: false, error: `Unknown message type: ${(message as any).type}` });
    }
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}

async function executeBrowserTool(toolName: string, params: Record<string, unknown>): Promise<unknown> {
  switch (toolName) {
    case 'browser_click':
      await executeBrowserClick(params.selector as string);
      return undefined;
    
    case 'browser_fill':
      await executeBrowserFill(params.selector as string, params.value as string);
      return undefined;
    
    case 'browser_type':
      await executeBrowserType(params.selector as string, params.text as string);
      return undefined;
    
    case 'browser_select':
      await executeBrowserSelect(params.selector as string, params.value as string);
      return undefined;
    
    case 'browser_get_text':
      return await executeBrowserGetText(params.selector as string);
    
    case 'browser_get_html':
      return await executeBrowserGetHTML(params.selector as string);
    
    case 'browser_screenshot':
      return await executeBrowserScreenshot();
    
    case 'browser_scroll':
      await executeBrowserScroll(params.direction as 'up' | 'down', params.amount as number);
      return undefined;
    
    case 'browser_wait':
      await executeBrowserWait(params.selector as string, params.timeout as number);
      return undefined;
    
    default:
      throw new Error(`Unknown browser tool: ${toolName}`);
  }
}

console.log('PixelMate content script loaded');
