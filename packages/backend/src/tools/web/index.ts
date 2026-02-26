import { Tool, ToolResult, ToolParameter } from '../types.js';
import { chromium, Browser, Page } from 'playwright';

type ParamType = 'string' | 'number' | 'boolean' | 'object' | 'array';

function param(name: string, description: string, type: ParamType, required: boolean, defaultValue?: unknown): ToolParameter {
  return { name, description, type, required, default: defaultValue };
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

export class WebSearchTool implements Tool {
  definition = {
    name: 'web_search',
    description: 'Search the web for information using Google. Returns top results with titles, URLs, and snippets.',
    parameters: [
      param('query', 'The search query', 'string', true),
      param('numResults', 'Number of results to return (default: 10)', 'number', false, 10)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const query = params.query as string;
    const numResults = (params.numResults as number) || 10;

    try {
      const playwrightBrowser = await getBrowser();
      const page = await playwrightBrowser.newPage();
      
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${numResults}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      await page.waitForSelector('div.g', { timeout: 10000 }).catch(() => {});

      const results: SearchResult[] = await page.evaluate(() => {
        const searchResults: SearchResult[] = [];
        const gElements = document.querySelectorAll('div.g');
        
        for (let i = 0; i < Math.min(gElements.length, 10); i++) {
          const el = gElements[i];
          const titleEl = el.querySelector('h3');
          const linkEl = el.querySelector('a');
          const snippetEl = el.querySelector('div.VwiC3b');
          
          if (titleEl && linkEl) {
            const title = titleEl.textContent || '';
            const url = linkEl.href || '';
            const snippet = snippetEl ? snippetEl.textContent || '' : '';
            
            if (title && url) {
              searchResults.push({ title, url, snippet });
            }
          }
        }
        
        return searchResults;
      });

      await page.close();

      return { 
        success: true, 
        output: JSON.stringify(results, null, 2) 
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class FetchWebPageTool implements Tool {
  definition = {
    name: 'fetch_web_page',
    description: 'Fetch and extract text content from a web page',
    parameters: [
      param('url', 'The URL of the web page to fetch', 'string', true),
      param('selector', 'Optional CSS selector to extract specific content', 'string', false)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const url = params.url as string;
    const selector = params.selector as string | undefined;

    try {
      const playwrightBrowser = await getBrowser();
      const page = await playwrightBrowser.newPage();
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      let content: string;

      if (selector) {
        content = await page.textContent(selector) || '';
      } else {
        content = await page.evaluate(() => {
          const article = document.querySelector('article');
          const main = document.querySelector('main');
          const body = article || main || document.body;
          
          const scripts = body.querySelectorAll('script, style, nav, header, footer');
          scripts.forEach((el: Element) => el.remove());
          
          return body.textContent || '';
        });
      }

      await page.close();

      return { 
        success: true, 
        output: content.trim().substring(0, 50000) 
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class SummarizeWebSearchTool implements Tool {
  private searchTool: WebSearchTool;
  private fetchTool: FetchWebPageTool;

  constructor() {
    this.searchTool = new WebSearchTool();
    this.fetchTool = new FetchWebPageTool();
  }

  definition = {
    name: 'research_topic',
    description: 'Search the web for a topic and fetch detailed information from top results',
    parameters: [
      param('query', 'The research query', 'string', true),
      param('numSources', 'Number of sources to fetch in detail (default: 3)', 'number', false, 3)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const query = params.query as string;
    const numSources = (params.numSources as number) || 3;

    try {
      const searchResult = await this.searchTool.execute({
        query,
        numResults: numSources
      });

      if (!searchResult.success) {
        return searchResult;
      }

      const results = JSON.parse(searchResult.output || '[]') as SearchResult[];
      const summaries: Array<{ title: string; url: string; content: string }> = [];

      for (const result of results.slice(0, numSources)) {
        const fetchResult = await this.fetchTool.execute({ url: result.url });
        
        summaries.push({
          title: result.title,
          url: result.url,
          content: fetchResult.success ? (fetchResult.output || '').substring(0, 3000) : 'Could not fetch content'
        });
      }

      return {
        success: true,
        output: JSON.stringify(summaries, null, 2)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
