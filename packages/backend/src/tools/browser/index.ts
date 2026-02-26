import { Tool, ToolResult, ToolParameter } from '../types.js';
import { browserManager } from './manager.js';
import { v4 as uuidv4 } from 'uuid';

type ParamType = 'string' | 'number' | 'boolean' | 'object' | 'array';

function param(name: string, description: string, type: ParamType, required: boolean, defaultValue?: unknown): ToolParameter {
  return { name, description, type, required, default: defaultValue };
}

export class NavigateTool implements Tool {
  definition = {
    name: 'browser_navigate',
    description: 'Navigate to a URL in the browser',
    parameters: [
      param('url', 'The URL to navigate to', 'string', true),
      param('pageId', 'The page ID to use (optional, creates new page if not provided)', 'string', false)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      let pageId = params.pageId as string;
      if (!pageId) {
        pageId = uuidv4();
      }

      const page = await browserManager.createPage('default', pageId);
      await page.goto(params.url as string);

      const title = await page.title();
      return {
        success: true,
        output: JSON.stringify({ pageId, title, url: params.url }),
        metadata: { pageId, title }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class ClickTool implements Tool {
  definition = {
    name: 'browser_click',
    description: 'Click on an element in the page',
    parameters: [
      param('selector', 'CSS selector or text to click', 'string', true),
      param('pageId', 'The page ID', 'string', false, 'default')
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const page = browserManager.getPage(params.pageId as string || 'default');
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      await page.click(params.selector as string);
      return { success: true, output: `Clicked: ${params.selector}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class FillTool implements Tool {
  definition = {
    name: 'browser_fill',
    description: 'Fill an input field with text',
    parameters: [
      param('selector', 'CSS selector for the input', 'string', true),
      param('value', 'The value to fill', 'string', true),
      param('pageId', 'The page ID', 'string', false, 'default')
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const page = browserManager.getPage(params.pageId as string || 'default');
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      await page.fill(params.selector as string, params.value as string);
      return { success: true, output: `Filled: ${params.selector}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class TypeTool implements Tool {
  definition = {
    name: 'browser_type',
    description: 'Type text into an element with optional delays',
    parameters: [
      param('selector', 'CSS selector for the input', 'string', true),
      param('text', 'The text to type', 'string', true),
      param('delay', 'Delay between keystrokes in ms', 'number', false, 0),
      param('pageId', 'The page ID', 'string', false, 'default')
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const page = browserManager.getPage(params.pageId as string || 'default');
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      await page.type(
        params.selector as string,
        params.text as string,
        { delay: (params.delay as number) || 0 }
      );
      return { success: true, output: `Typed: ${params.text}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class SelectTool implements Tool {
  definition = {
    name: 'browser_select',
    description: 'Select an option from a dropdown',
    parameters: [
      param('selector', 'CSS selector for the select element', 'string', true),
      param('value', 'The value to select', 'string', true),
      param('pageId', 'The page ID', 'string', false, 'default')
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const page = browserManager.getPage(params.pageId as string || 'default');
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      await page.selectOption(params.selector as string, params.value as string);
      return { success: true, output: `Selected: ${params.value}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class GetTextTool implements Tool {
  definition = {
    name: 'browser_get_text',
    description: 'Get the text content of an element',
    parameters: [
      param('selector', 'CSS selector for the element', 'string', true),
      param('pageId', 'The page ID', 'string', false, 'default')
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const page = browserManager.getPage(params.pageId as string || 'default');
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      const text = await page.textContent(params.selector as string);
      return { success: true, output: text || '' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class GetHtmlTool implements Tool {
  definition = {
    name: 'browser_get_html',
    description: 'Get the HTML content of an element or the entire page',
    parameters: [
      param('selector', 'CSS selector (optional, gets full page if not provided)', 'string', false),
      param('pageId', 'The page ID', 'string', false, 'default')
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const page = browserManager.getPage(params.pageId as string || 'default');
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      let html: string;
      if (params.selector) {
        html = await page.innerHTML(params.selector as string);
      } else {
        html = await page.content();
      }

      return { success: true, output: html };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class ScreenshotTool implements Tool {
  definition = {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the page or element',
    parameters: [
      param('path', 'File path to save the screenshot', 'string', false),
      param('selector', 'CSS selector for specific element (optional)', 'string', false),
      param('fullPage', 'Take screenshot of full page', 'boolean', false, false),
      param('pageId', 'The page ID', 'string', false, 'default')
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const page = browserManager.getPage(params.pageId as string || 'default');
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      const options: { path?: string; fullPage?: boolean } = {};
      if (params.path) {
        options.path = params.path as string;
      }
      if (params.fullPage) {
        options.fullPage = params.fullPage as boolean;
      }

      if (params.selector) {
        const element = await page.$(params.selector as string);
        if (!element) {
          return { success: false, error: 'Element not found' };
        }
        await element.screenshot(options);
      } else {
        await page.screenshot(options);
      }

      return { success: true, output: `Screenshot saved: ${params.path || 'buffer'}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class SnapshotTool implements Tool {
  definition = {
    name: 'browser_snapshot',
    description: 'Get an accessibility snapshot of the page for AI understanding',
    parameters: [
      param('pageId', 'The page ID', 'string', false, 'default')
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const page = browserManager.getPage(params.pageId as string || 'default');
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      // Get basic page info as a simple snapshot
      const title = await page.title();
      const url = page.url();
      
      const snapshot = { title, url };
      return { success: true, output: JSON.stringify(snapshot, null, 2) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class ScrollTool implements Tool {
  definition = {
    name: 'browser_scroll',
    description: 'Scroll the page or element',
    parameters: [
      param('x', 'X position to scroll to', 'number', false),
      param('y', 'Y position to scroll to', 'number', false),
      param('deltaY', 'Delta Y for relative scroll', 'number', false),
      param('selector', 'CSS selector for element to scroll (optional)', 'string', false),
      param('pageId', 'The page ID', 'string', false, 'default')
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const page = browserManager.getPage(params.pageId as string || 'default');
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      if (params.selector) {
        await page.locator(params.selector as string).scrollIntoViewIfNeeded();
        return { success: true, output: 'Scrolled to element' };
      }
      
      return { success: true, output: 'Use selector to scroll to element' };

      return { success: true, output: 'Scrolled' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class WaitForSelectorTool implements Tool {
  definition = {
    name: 'browser_wait',
    description: 'Wait for an element to appear on the page',
    parameters: [
      param('selector', 'CSS selector to wait for', 'string', true),
      param('timeout', 'Timeout in ms', 'number', false, 30000),
      param('state', 'Wait for state: attached, visible, hidden, detached', 'string', false, 'visible'),
      param('pageId', 'The page ID', 'string', false, 'default')
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const page = browserManager.getPage(params.pageId as string || 'default');
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      await page.waitForSelector(
        params.selector as string,
        { 
          timeout: (params.timeout as number) || 30000,
          state: (params.state as 'attached' | 'visible' | 'hidden' | 'detached') || 'visible'
        }
      );

      return { success: true, output: `Element found: ${params.selector}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class ClosePageTool implements Tool {
  definition = {
    name: 'browser_close_page',
    description: 'Close a browser page',
    parameters: [
      param('pageId', 'The page ID to close', 'string', true)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      await browserManager.closePage(params.pageId as string);
      return { success: true, output: `Closed page: ${params.pageId}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
