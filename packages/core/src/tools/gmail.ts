/**
 * Gmail tools — list, read, search, send
 * Uses Gmail API v1. Token is provided by the service worker via getToken().
 */

import { Tool, ToolDefinition, ToolResult } from '@pixelmate/shared';
import type { GetToken } from './google-workspace.js';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

class GmailClient {
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
      throw new Error(`Gmail API error ${res.status}: ${err}`);
    }
    return res.json() as Promise<T>;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return atob(base64);
  } catch {
    return str;
  }
}

function extractHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function extractBody(payload: GmailPayload): string {
  // Prefer plain text part
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  // Recurse into multipart
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  // Fallback to body.data
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  return '';
}

interface GmailPayload {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
  headers?: Array<{ name: string; value: string }>;
}

// ─── List emails ──────────────────────────────────────────────────────────────

export class GmailListTool implements Tool {
  definition: ToolDefinition = {
    name: 'gmail_list',
    description: 'List recent emails from Gmail inbox. Returns a summary of each message.',
    parameters: [
      { name: 'maxResults', description: 'Max number of emails to return (default: 10)', type: 'number', required: false },
      { name: 'labelIds',   description: 'Comma-separated label IDs to filter by (default: INBOX)', type: 'string', required: false },
    ],
  };

  private client: GmailClient;
  constructor(getToken: GetToken) { this.client = new GmailClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const maxResults = Math.min((params.maxResults as number | undefined) ?? 10, 50);
      const labelIds   = ((params.labelIds as string | undefined) ?? 'INBOX').split(',').map(s => s.trim());

      const listUrl = `${GMAIL_BASE}/messages?maxResults=${maxResults}&labelIds=${labelIds.join('&labelIds=')}`;
      const list    = await this.client.json<{ messages?: Array<{ id: string }> }>(listUrl);
      const ids     = list.messages ?? [];

      if (ids.length === 0) return { success: true, output: 'No messages found.' };

      // Fetch metadata for each message in parallel
      const metas = await Promise.all(ids.map(({ id }) =>
        this.client.json<{ id: string; snippet: string; payload: GmailPayload }>(
          `${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
        )
      ));

      const lines = metas.map((msg, i) => {
        const from    = extractHeader(msg.payload.headers ?? [], 'from');
        const subject = extractHeader(msg.payload.headers ?? [], 'subject');
        const date    = extractHeader(msg.payload.headers ?? [], 'date');
        return `${i + 1}. [${msg.id}] ${subject}\n   From: ${from}  |  ${date}\n   ${msg.snippet}`;
      });

      return { success: true, output: lines.join('\n\n') };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ─── Read email ───────────────────────────────────────────────────────────────

export class GmailReadTool implements Tool {
  definition: ToolDefinition = {
    name: 'gmail_read',
    description: 'Read the full content of a Gmail message by its message ID.',
    parameters: [
      { name: 'messageId', description: 'Gmail message ID (from gmail_list or gmail_search)', type: 'string', required: true },
    ],
  };

  private client: GmailClient;
  constructor(getToken: GetToken) { this.client = new GmailClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const msgId = params.messageId as string;
      const msg   = await this.client.json<{ id: string; payload: GmailPayload }>(
        `${GMAIL_BASE}/messages/${msgId}?format=full`
      );

      const headers = msg.payload.headers ?? [];
      const from    = extractHeader(headers, 'from');
      const to      = extractHeader(headers, 'to');
      const subject = extractHeader(headers, 'subject');
      const date    = extractHeader(headers, 'date');
      const body    = extractBody(msg.payload);

      return {
        success: true,
        output: `From: ${from}\nTo: ${to}\nDate: ${date}\nSubject: ${subject}\n\n${body}`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ─── Search emails ────────────────────────────────────────────────────────────

export class GmailSearchTool implements Tool {
  definition: ToolDefinition = {
    name: 'gmail_search',
    description: 'Search Gmail messages using Gmail search query syntax (e.g. "from:boss@co.com subject:report is:unread").',
    parameters: [
      { name: 'query',      description: 'Gmail search query',                                  type: 'string', required: true  },
      { name: 'maxResults', description: 'Max number of results (default: 10)',                 type: 'number', required: false },
    ],
  };

  private client: GmailClient;
  constructor(getToken: GetToken) { this.client = new GmailClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const query      = params.query as string;
      const maxResults = Math.min((params.maxResults as number | undefined) ?? 10, 50);

      const list = await this.client.json<{ messages?: Array<{ id: string }> }>(
        `${GMAIL_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
      );
      const ids = list.messages ?? [];

      if (ids.length === 0) return { success: true, output: `No messages found for query: "${query}"` };

      const metas = await Promise.all(ids.map(({ id }) =>
        this.client.json<{ id: string; snippet: string; payload: GmailPayload }>(
          `${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
        )
      ));

      const lines = metas.map((msg, i) => {
        const from    = extractHeader(msg.payload.headers ?? [], 'from');
        const subject = extractHeader(msg.payload.headers ?? [], 'subject');
        const date    = extractHeader(msg.payload.headers ?? [], 'date');
        return `${i + 1}. [${msg.id}] ${subject}\n   From: ${from}  |  ${date}\n   ${msg.snippet}`;
      });

      return { success: true, output: `Found ${ids.length} message(s):\n\n${lines.join('\n\n')}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ─── Send email ───────────────────────────────────────────────────────────────

export class GmailSendTool implements Tool {
  definition: ToolDefinition = {
    name: 'gmail_send',
    description: 'Send an email via Gmail. Requires google.send scope (grant in Settings → Google).',
    parameters: [
      { name: 'to',      description: 'Recipient email address(es), comma-separated',      type: 'string', required: true  },
      { name: 'subject', description: 'Email subject',                                     type: 'string', required: true  },
      { name: 'body',    description: 'Email body (plain text)',                            type: 'string', required: true  },
      { name: 'cc',      description: 'CC address(es), comma-separated (optional)',         type: 'string', required: false },
    ],
  };

  private client: GmailClient;
  constructor(getToken: GetToken) { this.client = new GmailClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const to      = params.to      as string;
      const subject = params.subject as string;
      const body    = params.body    as string;
      const cc      = params.cc      as string | undefined;

      const headers = [
        `To: ${to}`,
        `Subject: ${subject}`,
        cc ? `Cc: ${cc}` : null,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        body,
      ].filter(Boolean).join('\r\n');

      // Gmail API requires base64url-encoded RFC 2822 message
      const encoded = btoa(unescape(encodeURIComponent(headers)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const result = await this.client.json<{ id: string; threadId: string }>(
        `${GMAIL_BASE}/messages/send`,
        { method: 'POST', body: JSON.stringify({ raw: encoded }) }
      );

      return { success: true, output: `Email sent successfully. Message ID: ${result.id}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ─── Reply to email ───────────────────────────────────────────────────────────

export class GmailReplyTool implements Tool {
  definition: ToolDefinition = {
    name: 'gmail_reply',
    description: 'Reply to an existing Gmail message thread.',
    parameters: [
      { name: 'messageId', description: 'Message ID to reply to (from gmail_list or gmail_search)', type: 'string', required: true },
      { name: 'body',      description: 'Reply body (plain text)',                                   type: 'string', required: true },
    ],
  };

  private client: GmailClient;
  constructor(getToken: GetToken) { this.client = new GmailClient(getToken); }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const messageId = params.messageId as string;
      const replyBody = params.body as string;

      // Fetch original message to get Thread-Id, subject, from
      const original = await this.client.json<{
        threadId: string;
        payload: GmailPayload;
      }>(`${GMAIL_BASE}/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID`);

      const headers  = original.payload.headers ?? [];
      const from     = extractHeader(headers, 'from');
      const subject  = extractHeader(headers, 'subject');
      const msgRefId = extractHeader(headers, 'message-id');

      const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
      const rawHeaders   = [
        `To: ${from}`,
        `Subject: ${replySubject}`,
        msgRefId ? `In-Reply-To: ${msgRefId}` : null,
        msgRefId ? `References: ${msgRefId}` : null,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        replyBody,
      ].filter(Boolean).join('\r\n');

      const encoded = btoa(unescape(encodeURIComponent(rawHeaders)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const result = await this.client.json<{ id: string }>(
        `${GMAIL_BASE}/messages/send`,
        { method: 'POST', body: JSON.stringify({ raw: encoded, threadId: original.threadId }) }
      );

      return { success: true, output: `Reply sent. Message ID: ${result.id}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
