/**
 * ExtensionBridge — connects the PixelMate PWA to the Chrome extension service worker.
 *
 * Works in two contexts:
 *   1. If the page is the extension's own page (popup, options, etc.):
 *      chrome.runtime is available natively.
 *   2. If the page is an external PWA origin (localhost, pixelmate.app, etc.):
 *      the extension must list the origin in externally_connectable.
 *      The caller must provide the extension ID (PIXELMATE_EXTENSION_ID env var or
 *      window.__PIXELMATE_EXT_ID injected by a content script).
 */

export interface AgentEvent {
  type: 'state_change' | 'thought' | 'tool_call' | 'tool_result' | 'message' | 'error';
  state?: string;
  thought?: string;
  toolCall?: { name: string; parameters?: Record<string, unknown> };
  toolResult?: { success: boolean; output?: string; error?: string };
  message?: string;
  error?: string;
}

export interface FileMeta {
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface Session {
  id: string;
  title: string;
  createdAt: string;
}

export interface ToolMeta {
  name: string;
  description: string;
}

export type OnEventCallback = (event: AgentEvent) => void;
export type OnCompleteCallback = (result: string) => void;
export type OnErrorCallback = (error: string) => void;

declare global {
  interface Window {
    __PIXELMATE_EXT_ID?: string;
  }
}

/** Resolve the extension ID from environment / injected globals */
function resolveExtensionId(): string | undefined {
  try {
    // Running inside the extension itself
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      return chrome.runtime.id;
    }
  } catch {
    // chrome not available in this context
  }
  // Injected by content script
  if (typeof window !== 'undefined' && window.__PIXELMATE_EXT_ID) {
    return window.__PIXELMATE_EXT_ID;
  }
  // Build-time environment variable (Vite)
  const envId = (import.meta.env as Record<string, string | undefined>).VITE_EXTENSION_ID;
  return envId;
}

export class ExtensionBridge {
  private extensionId: string | undefined;
  private port: chrome.runtime.Port | null = null;

  constructor(extensionId?: string) {
    this.extensionId = extensionId ?? resolveExtensionId();
  }

  /** Returns true if chrome.runtime is accessible */
  isAvailable(): boolean {
    try {
      return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
    } catch {
      return false;
    }
  }

  /**
   * Send a fire-and-forget message and await a response.
   */
  private sendMessage<T = Record<string, unknown>>(
    message: Record<string, unknown>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.isAvailable()) {
        reject(new Error('Chrome extension not available'));
        return;
      }
      const sendFn = chrome.runtime.sendMessage as (...args: unknown[]) => void;
      const args: unknown[] = this.extensionId
        ? [this.extensionId, message, (response: T) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }]
        : [message, (response: T) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }];

      sendFn(...args);
    });
  }

  /** Set API key for a provider */
  async setApiKey(provider: string, apiKey: string): Promise<void> {
    const res = await this.sendMessage<{ success: boolean; error?: string }>({
      type: 'SET_API_KEY',
      provider,
      apiKey,
    });
    if (!res.success) throw new Error(res.error ?? 'Failed to set API key');
  }

  /** Get config values by keys */
  async getConfig(keys: string[]): Promise<Record<string, unknown>> {
    const res = await this.sendMessage<{ success: boolean; values?: Record<string, unknown>; error?: string }>({
      type: 'GET_CONFIG',
      keys,
    });
    if (!res.success) throw new Error(res.error ?? 'Failed to get config');
    return res.values ?? {};
  }

  /** Get available tools */
  async getTools(): Promise<ToolMeta[]> {
    const res = await this.sendMessage<{ success: boolean; tools?: ToolMeta[]; error?: string }>({
      type: 'GET_TOOLS',
    });
    if (!res.success) throw new Error(res.error ?? 'Failed to get tools');
    return res.tools ?? [];
  }

  /** Get workspace files */
  async getFiles(): Promise<FileMeta[]> {
    const res = await this.sendMessage<{ success: boolean; files?: FileMeta[]; error?: string }>({
      type: 'GET_FILES',
    });
    if (!res.success) return [];
    return res.files ?? [];
  }

  /** Get recent sessions */
  async getSessions(): Promise<Session[]> {
    const res = await this.sendMessage<{ success: boolean; sessions?: Session[]; error?: string }>({
      type: 'GET_SESSIONS',
    });
    if (!res.success) return [];
    return res.sessions ?? [];
  }

  /** Save / update a session record */
  async saveSession(session: Session): Promise<void> {
    await this.sendMessage({
      type: 'SAVE_SESSION',
      session,
    });
  }

  /**
   * Request Google Workspace sign-in via chrome.identity.
   * Returns the access token on success.
   */
  async googleSignIn(): Promise<string> {
    const res = await this.sendMessage<{ success: boolean; token?: string; error?: string }>({
      type: 'GOOGLE_AUTH',
    });
    if (!res.success) throw new Error(res.error ?? 'Google sign-in failed');
    return res.token!;
  }

  /** Sign out of Google */
  async googleSignOut(): Promise<void> {
    await this.sendMessage({ type: 'GOOGLE_SIGNOUT' });
  }

  /** Request access to the local filesystem */
  async requestFileAccess(): Promise<void> {
    const res = await this.sendMessage<{ success: boolean; error?: string }>({
      type: 'REQUEST_FILE_ACCESS',
    });
    if (!res.success) throw new Error(res.error ?? 'File access request failed');
  }

  /**
   * Run an agent task with streaming events. Returns a cleanup function.
   *
   * @param prompt  The user instruction
   * @param opts    Optional session/skill/model/provider overrides
   * @param onEvent Called for each agent event (thought, tool_call, etc.)
   * @param onComplete Called with the final result text
   * @param onError Called on unrecoverable error
   */
  executeAgent(
    prompt: string,
    opts: { skill?: string; model?: string; provider?: string } = {},
    onEvent: OnEventCallback,
    onComplete: OnCompleteCallback,
    onError: OnErrorCallback
  ): () => void {
    if (!this.isAvailable()) {
      onError('Chrome extension is not installed or not connected.');
      return () => {};
    }

    // Disconnect any prior port
    this.port?.disconnect();

    const connectArgs = this.extensionId ? [this.extensionId, 'agent'] : ['agent'];
    this.port = (chrome.runtime.connect as Function)(...connectArgs) as chrome.runtime.Port;

    this.port.onMessage.addListener((msg: Record<string, unknown>) => {
      if (msg.type === 'AGENT_EVENT') {
        onEvent(msg.event as AgentEvent);
      } else if (msg.type === 'AGENT_COMPLETE') {
        onComplete(msg.result as string);
        this.port?.disconnect();
        this.port = null;
      } else if (msg.type === 'ERROR') {
        onError(msg.error as string);
        this.port?.disconnect();
        this.port = null;
      }
    });

    this.port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        onError(chrome.runtime.lastError.message ?? 'Extension disconnected');
      }
      this.port = null;
    });

    this.port.postMessage({
      type: 'AGENT_EXECUTE',
      prompt,
      ...opts,
    });

    // Return a cancel function
    return () => {
      this.port?.disconnect();
      this.port = null;
    };
  }

  disconnect(): void {
    this.port?.disconnect();
    this.port = null;
  }
}

// Singleton
export const bridge = new ExtensionBridge();
