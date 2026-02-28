/**
 * Google Workspace tools — Docs, Sheets, Slides
 * All tools accept a `getToken()` callback so the Chrome-specific
 * chrome.storage.session lookup stays in the service worker, not in core.
 */

import { Tool, ToolDefinition, ToolResult } from '@pixelmate/shared';

export type GetToken = () => Promise<string | null>;

// ─── Shared API client ────────────────────────────────────────────────────────

class GoogleApiClient {
  constructor(private getToken: GetToken) {}

  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();
    if (!token) throw new Error('Not signed in to Google. Use "Sign in with Google" in Settings first.');
    return fetch(url, {
      ...init,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  }

  async json<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetch(url, init);
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Google API error ${res.status}: ${err}`);
    }
    return res.json() as Promise<T>;
  }
}

// ─── Google Docs ──────────────────────────────────────────────────────────────

const DOCS_BASE = 'https://docs.googleapis.com/v1/documents';

/** Create a new Google Doc and optionally write initial content to it. */
export class GoogleDocsCreateTool implements Tool {
  definition: ToolDefinition = {
    name: 'google_docs_create',
    description: 'Create a new Google Doc and optionally populate it with content. Returns the document URL.',
    parameters: [
      { name: 'title',   description: 'Document title',                                        type: 'string', required: true  },
      { name: 'content', description: 'Initial text content to insert (optional)',              type: 'string', required: false },
    ],
  };

  private api: GoogleApiClient;
  constructor(getToken: GetToken) { this.api = new GoogleApiClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const title   = params.title as string;
      const content = (params.content as string | undefined) ?? '';

      // 1. Create the document
      const doc = await this.api.json<{ documentId: string }>(DOCS_BASE, {
        method: 'POST',
        body: JSON.stringify({ title }),
      });

      const docId = doc.documentId;

      // 2. Insert content if provided
      if (content.trim()) {
        await this.api.json(`${DOCS_BASE}/${docId}:batchUpdate`, {
          method: 'POST',
          body: JSON.stringify({
            requests: [{
              insertText: {
                location: { index: 1 },
                text: content,
              },
            }],
          }),
        });
      }

      return {
        success: true,
        output: `Created Google Doc "${title}"\nDocument ID: ${docId}\nURL: https://docs.google.com/document/d/${docId}/edit`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Read the plain text content of an existing Google Doc. */
export class GoogleDocsReadTool implements Tool {
  definition: ToolDefinition = {
    name: 'google_docs_read',
    description: 'Read the text content of a Google Doc by its ID or URL.',
    parameters: [
      { name: 'docId', description: 'Google Doc ID (the long string in the URL) or full URL', type: 'string', required: true },
    ],
  };

  private api: GoogleApiClient;
  constructor(getToken: GetToken) { this.api = new GoogleApiClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      let docId = params.docId as string;
      // Accept full URL
      const match = docId.match(/\/document\/d\/([^/]+)/);
      if (match) docId = match[1];

      const doc = await this.api.json<{
        title: string;
        body: { content: Array<{ paragraph?: { elements: Array<{ textRun?: { content: string } }> } }> };
      }>(`${DOCS_BASE}/${docId}`);

      const text = doc.body.content
        .flatMap(b => b.paragraph?.elements ?? [])
        .map(el => el.textRun?.content ?? '')
        .join('');

      return { success: true, output: `# ${doc.title}\n\n${text}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Append text to an existing Google Doc. */
export class GoogleDocsAppendTool implements Tool {
  definition: ToolDefinition = {
    name: 'google_docs_append',
    description: 'Append text to the end of an existing Google Doc.',
    parameters: [
      { name: 'docId',   description: 'Google Doc ID or URL',  type: 'string', required: true },
      { name: 'content', description: 'Text to append',        type: 'string', required: true },
    ],
  };

  private api: GoogleApiClient;
  constructor(getToken: GetToken) { this.api = new GoogleApiClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      let docId = params.docId as string;
      const match = docId.match(/\/document\/d\/([^/]+)/);
      if (match) docId = match[1];

      const content = params.content as string;

      // Get current end index
      const doc = await this.api.json<{ body: { content: Array<{ endIndex?: number }> } }>(`${DOCS_BASE}/${docId}`);
      const lastContent = doc.body.content[doc.body.content.length - 1];
      const endIndex = (lastContent?.endIndex ?? 1) - 1;

      await this.api.json(`${DOCS_BASE}/${docId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          requests: [{
            insertText: {
              location: { index: endIndex },
              text: content,
            },
          }],
        }),
      });

      return { success: true, output: `Appended content to Doc ${docId}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ─── Google Sheets ────────────────────────────────────────────────────────────

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/** Create a new Google Sheets spreadsheet and optionally write initial data. */
export class GoogleSheetsCreateTool implements Tool {
  definition: ToolDefinition = {
    name: 'google_sheets_create',
    description: 'Create a new Google Sheets spreadsheet and optionally populate it with data. Returns the spreadsheet URL.',
    parameters: [
      { name: 'title',     description: 'Spreadsheet title',                                                   type: 'string', required: true  },
      { name: 'data',      description: 'Initial 2D array of values to populate e.g. [["Name","Age"],["Alice",30]]', type: 'array', required: false },
      { name: 'sheetName', description: 'Sheet tab name (default: Sheet1)',                                    type: 'string', required: false },
    ],
  };

  private api: GoogleApiClient;
  constructor(getToken: GetToken) { this.api = new GoogleApiClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const title     = params.title as string;
      const data      = (params.data as unknown[][] | undefined) ?? [];
      const sheetName = (params.sheetName as string | undefined) ?? 'Sheet1';

      // 1. Create spreadsheet
      const sheet = await this.api.json<{ spreadsheetId: string }>(SHEETS_BASE, {
        method: 'POST',
        body: JSON.stringify({ properties: { title }, sheets: [{ properties: { title: sheetName } }] }),
      });

      const id = sheet.spreadsheetId;

      // 2. Write initial data if provided
      if (data.length > 0) {
        await this.api.json(`${SHEETS_BASE}/${id}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED`, {
          method: 'POST',
          body: JSON.stringify({ values: data }),
        });
      }

      return {
        success: true,
        output: `Created Google Sheet "${title}"\nSpreadsheet ID: ${id}\nURL: https://docs.google.com/spreadsheets/d/${id}/edit`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Read values from a Google Sheet range. */
export class GoogleSheetsReadTool implements Tool {
  definition: ToolDefinition = {
    name: 'google_sheets_read',
    description: 'Read cell values from a Google Sheet. Returns data as a 2D array.',
    parameters: [
      { name: 'spreadsheetId', description: 'Spreadsheet ID or URL',                       type: 'string', required: true  },
      { name: 'range',         description: 'A1 notation range e.g. "Sheet1!A1:D10" (default: first sheet all data)', type: 'string', required: false },
    ],
  };

  private api: GoogleApiClient;
  constructor(getToken: GetToken) { this.api = new GoogleApiClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      let id = params.spreadsheetId as string;
      const match = id.match(/\/spreadsheets\/d\/([^/]+)/);
      if (match) id = match[1];

      const range = (params.range as string | undefined) ?? 'A1:ZZ10000';

      const result = await this.api.json<{ values?: unknown[][] }>(
        `${SHEETS_BASE}/${id}/values/${encodeURIComponent(range)}`
      );

      const values = result.values ?? [];
      if (values.length === 0) return { success: true, output: '(empty sheet)' };

      const text = values.map(row => row.join('\t')).join('\n');
      return { success: true, output: text };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Write values to a range in a Google Sheet. */
export class GoogleSheetsWriteTool implements Tool {
  definition: ToolDefinition = {
    name: 'google_sheets_write',
    description: 'Write values to a range in a Google Sheet (overwrites existing data in that range).',
    parameters: [
      { name: 'spreadsheetId', description: 'Spreadsheet ID or URL',                                          type: 'string', required: true },
      { name: 'range',         description: 'A1 notation range to write to e.g. "Sheet1!A1"',                 type: 'string', required: true },
      { name: 'data',          description: '2D array of values e.g. [["Name","Score"],["Alice",95]]',         type: 'array',  required: true },
    ],
  };

  private api: GoogleApiClient;
  constructor(getToken: GetToken) { this.api = new GoogleApiClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      let id = params.spreadsheetId as string;
      const match = id.match(/\/spreadsheets\/d\/([^/]+)/);
      if (match) id = match[1];

      const range = params.range as string;
      const data  = params.data as unknown[][];

      await this.api.json(
        `${SHEETS_BASE}/${id}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        { method: 'PUT', body: JSON.stringify({ range, values: data }) }
      );

      return { success: true, output: `Wrote ${data.length} row(s) to ${range} in spreadsheet ${id}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ─── Google Slides ────────────────────────────────────────────────────────────

const SLIDES_BASE = 'https://slides.googleapis.com/v1/presentations';

/** Create a new Google Slides presentation with title slides. */
export class GoogleSlidesCreateTool implements Tool {
  definition: ToolDefinition = {
    name: 'google_slides_create',
    description: 'Create a new Google Slides presentation. Pass an array of slides each with a title and body text. Returns the presentation URL.',
    parameters: [
      { name: 'title',  description: 'Presentation title',                                                            type: 'string', required: true },
      { name: 'slides', description: 'Array of slide objects: [{"title":"Slide 1","body":"Content here"}, ...]',       type: 'array',  required: true },
    ],
  };

  private api: GoogleApiClient;
  constructor(getToken: GetToken) { this.api = new GoogleApiClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const title  = params.title as string;
      const slides = params.slides as Array<{ title: string; body: string }>;

      // 1. Create presentation
      const pres = await this.api.json<{ presentationId: string }>(SLIDES_BASE, {
        method: 'POST',
        body: JSON.stringify({ title }),
      });

      const presId = pres.presentationId;

      // 2. Build batchUpdate requests for each slide
      const requests: unknown[] = [];

      slides.forEach((slide, idx) => {
        const slideId    = `slide_${idx}`;
        const titleId    = `title_${idx}`;
        const bodyId     = `body_${idx}`;

        // Create slide
        requests.push({
          createSlide: {
            objectId: slideId,
            insertionIndex: idx,
            slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
            placeholderIdMappings: [
              { layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: titleId },
              { layoutPlaceholder: { type: 'BODY',  index: 0 }, objectId: bodyId  },
            ],
          },
        });
        // Insert title text
        requests.push({ insertText: { objectId: titleId, text: slide.title } });
        // Insert body text
        if (slide.body) {
          requests.push({ insertText: { objectId: bodyId, text: slide.body } });
        }
      });

      // Remove the blank default slide created with the presentation
      const presInfo = await this.api.json<{ slides: Array<{ objectId: string }> }>(`${SLIDES_BASE}/${presId}`);
      const defaultSlide = presInfo.slides?.[0];
      if (defaultSlide && !slides.find((_, i) => `slide_${i}` === defaultSlide.objectId)) {
        requests.push({ deleteObject: { objectId: defaultSlide.objectId } });
      }

      if (requests.length > 0) {
        await this.api.json(`${SLIDES_BASE}/${presId}:batchUpdate`, {
          method: 'POST',
          body: JSON.stringify({ requests }),
        });
      }

      return {
        success: true,
        output: `Created Google Slides "${title}" with ${slides.length} slide(s)\nPresentation ID: ${presId}\nURL: https://docs.google.com/presentation/d/${presId}/edit`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Read slide titles and body text from an existing presentation. */
export class GoogleSlidesReadTool implements Tool {
  definition: ToolDefinition = {
    name: 'google_slides_read',
    description: 'Read the content (slide titles and body text) of a Google Slides presentation.',
    parameters: [
      { name: 'presentationId', description: 'Presentation ID or full URL', type: 'string', required: true },
    ],
  };

  private api: GoogleApiClient;
  constructor(getToken: GetToken) { this.api = new GoogleApiClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      let id = params.presentationId as string;
      const match = id.match(/\/presentation\/d\/([^/]+)/);
      if (match) id = match[1];

      const pres = await this.api.json<{
        title: string;
        slides: Array<{
          pageElements?: Array<{
            shape?: {
              placeholder?: { type: string };
              text?: { textElements: Array<{ textRun?: { content: string } }> };
            };
          }>;
        }>;
      }>(`${SLIDES_BASE}/${id}`);

      const lines = [`# ${pres.title}`, ''];
      pres.slides?.forEach((slide, i) => {
        lines.push(`## Slide ${i + 1}`);
        slide.pageElements?.forEach(el => {
          const text = el.shape?.text?.textElements
            .map(t => t.textRun?.content ?? '').join('').trim();
          if (text) lines.push(text);
        });
        lines.push('');
      });

      return { success: true, output: lines.join('\n') };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
