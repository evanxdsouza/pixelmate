/**
 * Browser automation tools implemented using Chrome Extension APIs
 * These tools communicate with content scripts via chrome.tabs.sendMessage
 */

import { Tool, ToolDefinition, ToolResult } from '@pixelmate/shared';

// Helper to send message to content script
async function sendToContentScript(tabId: number, message: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.success) {
        resolve(response.result);
      } else {
        reject(new Error(response?.error || 'Content script error'));
      }
    });
  });
}

// Helper to get active tab
async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0] || !tabs[0].id) {
    throw new Error('No active tab found');
  }
  return tabs[0];
}

export class BrowserNavigateTool implements Tool {
  definition: ToolDefinition = {
    name: 'browser_navigate',
    description: 'Navigate to a URL',
    parameters: [
      { name: 'url', description: 'URL to navigate to', type: 'string', required: true }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const url = params.url as string;
      const tab = await getActiveTab();
      
      await chrome.tabs.update(tab.id!, { url });
      
      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return { success: true, output: `Navigated to ${url}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class BrowserClickTool implements Tool {
  definition: ToolDefinition = {
    name: 'browser_click',
    description: 'Click an element on the page',
    parameters: [
      { name: 'selector', description: 'CSS selector of element to click', type: 'string', required: true }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const selector = params.selector as string;
      const tab = await getActiveTab();
      
      await sendToContentScript(tab.id!, {
        type: 'EXECUTE_BROWSER_TOOL',
        tool: 'browser_click',
        params: { selector }
      });
      
      return { success: true, output: `Clicked ${selector}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class BrowserFillTool implements Tool {
  definition: ToolDefinition = {
    name: 'browser_fill',
    description: 'Fill an input field with text',
    parameters: [
      { name: 'selector', description: 'CSS selector of input element', type: 'string', required: true },
      { name: 'value', description: 'Value to fill', type: 'string', required: true }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const selector = params.selector as string;
      const value = params.value as string;
      const tab = await getActiveTab();
      
      await sendToContentScript(tab.id!, {
        type: 'EXECUTE_BROWSER_TOOL',
        tool: 'browser_fill',
        params: { selector, value }
      });
      
      return { success: true, output: `Filled ${selector} with value` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class BrowserTypeTool implements Tool {
  definition: ToolDefinition = {
    name: 'browser_type',
    description: 'Type text character by character into an element',
    parameters: [
      { name: 'selector', description: 'CSS selector of element to type in', type: 'string', required: true },
      { name: 'text', description: 'Text to type', type: 'string', required: true }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const selector = params.selector as string;
      const text = params.text as string;
      const tab = await getActiveTab();
      
      await sendToContentScript(tab.id!, {
        type: 'EXECUTE_BROWSER_TOOL',
        tool: 'browser_type',
        params: { selector, text }
      });
      
      return { success: true, output: `Typed text into ${selector}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class BrowserSelectTool implements Tool {
  definition: ToolDefinition = {
    name: 'browser_select',
    description: 'Select an option in a dropdown',
    parameters: [
      { name: 'selector', description: 'CSS selector of select element', type: 'string', required: true },
      { name: 'value', description: 'Value to select', type: 'string', required: true }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const selector = params.selector as string;
      const value = params.value as string;
      const tab = await getActiveTab();
      
      await sendToContentScript(tab.id!, {
        type: 'EXECUTE_BROWSER_TOOL',
        tool: 'browser_select',
        params: { selector, value }
      });
      
      return { success: true, output: `Selected ${value} in ${selector}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class BrowserGetTextTool implements Tool {
  definition: ToolDefinition = {
    name: 'browser_get_text',
    description: 'Get text content of an element',
    parameters: [
      { name: 'selector', description: 'CSS selector of element', type: 'string', required: true }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const selector = params.selector as string;
      const tab = await getActiveTab();
      
      const text = await sendToContentScript(tab.id!, {
        type: 'EXECUTE_BROWSER_TOOL',
        tool: 'browser_get_text',
        params: { selector }
      });
      
      return { success: true, output: String(text) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class BrowserGetHTMLTool implements Tool {
  definition: ToolDefinition = {
    name: 'browser_get_html',
    description: 'Get HTML content of an element',
    parameters: [
      { name: 'selector', description: 'CSS selector of element', type: 'string', required: true }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const selector = params.selector as string;
      const tab = await getActiveTab();
      
      const html = await sendToContentScript(tab.id!, {
        type: 'EXECUTE_BROWSER_TOOL',
        tool: 'browser_get_html',
        params: { selector }
      });
      
      return { success: true, output: String(html) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class BrowserScreenshotTool implements Tool {
  definition: ToolDefinition = {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current page',
    parameters: []
  };

  async execute(_params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const tab = await getActiveTab();
      
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId!, {
        format: 'png'
      });
      
      return { success: true, output: dataUrl };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class BrowserScrollTool implements Tool {
  definition: ToolDefinition = {
    name: 'browser_scroll',
    description: 'Scroll the page',
    parameters: [
      { name: 'direction', description: 'Direction to scroll (up or down)', type: 'string', required: true },
      { name: 'amount', description: 'Number of pixels to scroll', type: 'number', required: true }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const direction = params.direction as string;
      const amount = params.amount as number;
      const tab = await getActiveTab();
      
      await sendToContentScript(tab.id!, {
        type: 'EXECUTE_BROWSER_TOOL',
        tool: 'browser_scroll',
        params: { direction, amount }
      });
      
      return { success: true, output: `Scrolled ${direction} by ${amount}px` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class BrowserWaitTool implements Tool {
  definition: ToolDefinition = {
    name: 'browser_wait',
    description: 'Wait for an element to appear on the page',
    parameters: [
      { name: 'selector', description: 'CSS selector of element to wait for', type: 'string', required: true },
      { name: 'timeout', description: 'Timeout in milliseconds', type: 'number', required: false }
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const selector = params.selector as string;
      const timeout = (params.timeout as number) || 5000;
      const tab = await getActiveTab();
      
      await sendToContentScript(tab.id!, {
        type: 'EXECUTE_BROWSER_TOOL',
        tool: 'browser_wait',
        params: { selector, timeout }
      });
      
      return { success: true, output: `Element ${selector} appeared` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
