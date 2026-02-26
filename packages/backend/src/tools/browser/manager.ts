import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config } from '../../config/index.js';

export class BrowserManager {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private pages: Map<string, Page> = new Map();
  private headless: boolean;

  constructor() {
    this.headless = config.get('BROWSER_HEADLESS') === 'true';
  }

  async launch(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    this.browser = await chromium.launch({
      headless: this.headless,
      args: ['--disable-blink-features=AutomationControlled']
    });

    return this.browser;
  }

  async createContext(contextId: string): Promise<BrowserContext> {
    await this.launch();
    const context = await this.browser!.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    this.contexts.set(contextId, context);
    return context;
  }

  async createPage(contextId: string, pageId: string): Promise<Page> {
    let context = this.contexts.get(contextId);
    if (!context) {
      context = await this.createContext(contextId);
    }

    const page = await context.newPage();
    this.pages.set(pageId, page);
    return page;
  }

  getPage(pageId: string): Page | undefined {
    return this.pages.get(pageId);
  }

  getContext(contextId: string): BrowserContext | undefined {
    return this.contexts.get(contextId);
  }

  async closePage(pageId: string): Promise<void> {
    const page = this.pages.get(pageId);
    if (page) {
      await page.close();
      this.pages.delete(pageId);
    }
  }

  async closeContext(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (context) {
      await context.close();
      this.contexts.delete(contextId);
    }
  }

  async close(): Promise<void> {
    for (const page of this.pages.values()) {
      await page.close();
    }
    this.pages.clear();

    for (const context of this.contexts.values()) {
      await context.close();
    }
    this.contexts.clear();

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  isRunning(): boolean {
    return this.browser !== null;
  }
}

export const browserManager = new BrowserManager();
