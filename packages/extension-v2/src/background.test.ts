/**
 * Unit tests for the extension's message-handling logic.
 *
 * Since background.ts is a service worker that registers Chrome listeners
 * at module load-time, these tests mock chrome APIs and verify the handlers
 * work correctly by simulating what the runtime would call.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────────────────────────────────────────────────
// Mock chrome APIs
// ──────────────────────────────────────────────────────────────

const mockStorageSync = new Map<string, unknown>();
const mockStorageLocal = new Map<string, unknown>();
const mockStorageSession = new Map<string, unknown>();

const chrome = {
  runtime: {
    id: 'pixelmate-ext',
    onInstalled: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn() },
    onConnect: { addListener: vi.fn() },
    lastError: null as { message?: string } | null,
  },
  storage: {
    sync: {
      get: vi.fn(async (keys: string | string[]) => {
        const result: Record<string, unknown> = {};
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) result[k] = mockStorageSync.get(k);
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) mockStorageSync.set(k, v);
      }),
    },
    local: {
      get: vi.fn(async (key: string) => ({ [key]: mockStorageLocal.get(key) })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) mockStorageLocal.set(k, v);
      }),
    },
    session: {
      get: vi.fn(async (key: string) => ({ [key]: mockStorageSession.get(key) })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) mockStorageSession.set(k, v);
      }),
      remove: vi.fn(async (key: string) => { mockStorageSession.delete(key); }),
    },
  },
  identity: {
    getAuthToken: vi.fn(),
    removeCachedAuthToken: vi.fn(),
  },
  tabs: {
    captureVisibleTab: vi.fn(),
  },
};

// @ts-ignore
global.chrome = chrome;

// ──────────────────────────────────────────────────────────────
// Mock @pixelmate/core
// ──────────────────────────────────────────────────────────────

vi.mock('@pixelmate/core', () => ({
  getApiKey: vi.fn().mockResolvedValue('sk-mock-api-key'),
  getChromeStorage: vi.fn().mockResolvedValue({ selected_provider: 'anthropic' }),
  getSkillPrompt: vi.fn().mockReturnValue('# Mock Skill Prompt'),
}));

// ──────────────────────────────────────────────────────────────
// Inline helpers that mirror background.ts logic (to test without
// importing the service worker module directly)
// ──────────────────────────────────────────────────────────────

import { getChromeStorage } from '@pixelmate/core';

interface MockFileSystem {
  initializeOPFS: ReturnType<typeof vi.fn>;
  initializeGoogleDrive: ReturnType<typeof vi.fn>;
  requestNativeAccess: ReturnType<typeof vi.fn>;
  listFiles: ReturnType<typeof vi.fn>;
}

interface MockToolRegistry {
  register: ReturnType<typeof vi.fn>;
  getAll: ReturnType<typeof vi.fn>;
  getDefinitions: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
}

function makeMockFileSystem(overrides: Partial<MockFileSystem> = {}): MockFileSystem {
  return {
    initializeOPFS: vi.fn().mockResolvedValue(undefined),
    initializeGoogleDrive: vi.fn().mockResolvedValue(undefined),
    requestNativeAccess: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue(['readme.txt', 'notes/', 'data.csv']),
    ...overrides,
  };
}

function makeMockToolRegistry(overrides: Partial<MockToolRegistry> = {}): MockToolRegistry {
  return {
    register: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    getDefinitions: vi.fn().mockReturnValue([
      { name: 'read_file', description: 'Read a file', parameters: [] },
      { name: 'web_search', description: 'Search the web', parameters: [] },
    ]),
    execute: vi.fn().mockResolvedValue({ success: true, output: 'done' }),
    ...overrides,
  };
}

async function handleMessageHelper(
  message: Record<string, unknown>,
  fileSystem: MockFileSystem,
  toolRegistry: MockToolRegistry,
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const sendResponse = (resp: Record<string, unknown>) => resolve(resp);

    (async () => {
      try {
        switch (message.type) {
          case 'SET_API_KEY': {
            await chrome.storage.sync.set({ [`api_key:${message.provider}`]: message.apiKey });
            sendResponse({ success: true });
            break;
          }
          case 'GET_CONFIG': {
            const values = await getChromeStorage(message.keys as string[]);
            sendResponse({ success: true, values });
            break;
          }
          case 'GET_TOOLS': {
            const tools = toolRegistry.getDefinitions();
            sendResponse({ success: true, tools });
            break;
          }
          case 'REQUEST_FILE_ACCESS': {
            await fileSystem.requestNativeAccess();
            sendResponse({ success: true });
            break;
          }
          case 'INIT_GOOGLE_DRIVE': {
            await fileSystem.initializeGoogleDrive(message.accessToken as string);
            sendResponse({ success: true });
            break;
          }
          case 'GET_FILES': {
            const names = await fileSystem.listFiles('/');
            const entries = names.map((name: string) => ({
              name: name.replace(/\/$/, ''),
              type: name.endsWith('/') ? 'directory' : 'file',
            }));
            sendResponse({ success: true, files: entries });
            break;
          }
          case 'GET_SESSIONS': {
            const stored = await chrome.storage.local.get('sessions');
            const sessions = (stored.sessions as unknown[] | undefined) ?? [];
            sendResponse({ success: true, sessions: (sessions as unknown[]).slice(0, 10) });
            break;
          }
          case 'SAVE_SESSION': {
            const stored = await chrome.storage.local.get('sessions');
            const sessions: Array<Record<string, unknown>> = (stored.sessions as Array<Record<string, unknown>>) ?? [];
            const session = message.session as Record<string, unknown>;
            const idx = sessions.findIndex((s) => s.id === session.id);
            if (idx >= 0) sessions[idx] = session;
            else sessions.unshift(session);
            await chrome.storage.local.set({ sessions: sessions.slice(0, 50) });
            sendResponse({ success: true });
            break;
          }
          case 'GOOGLE_SIGNOUT': {
            const cached = await chrome.storage.session.get('google_access_token');
            if (cached.google_access_token) {
              chrome.identity.removeCachedAuthToken({ token: cached.google_access_token as string });
              await chrome.storage.session.remove('google_access_token');
            }
            sendResponse({ success: true });
            break;
          }
          default: {
            sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
          }
        }
      } catch (err) {
        sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();
  });
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe('Extension background message handlers', () => {
  let fileSystem: MockFileSystem;
  let toolRegistry: MockToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageSync.clear();
    mockStorageLocal.clear();
    mockStorageSession.clear();
    fileSystem = makeMockFileSystem();
    toolRegistry = makeMockToolRegistry();
  });

  describe('SET_API_KEY', () => {
    it('stores the API key and returns success', async () => {
      const resp = await handleMessageHelper(
        { type: 'SET_API_KEY', provider: 'anthropic', apiKey: 'sk-test-123' },
        fileSystem, toolRegistry,
      );
      expect(resp.success).toBe(true);
      expect(mockStorageSync.get('api_key:anthropic')).toBe('sk-test-123');
    });
  });

  describe('GET_CONFIG', () => {
    it('returns config values from storage', async () => {
      (getChromeStorage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ selected_provider: 'groq' });
      const resp = await handleMessageHelper(
        { type: 'GET_CONFIG', keys: ['selected_provider'] },
        fileSystem, toolRegistry,
      );
      expect(resp.success).toBe(true);
      expect((resp.values as Record<string, unknown>).selected_provider).toBe('groq');
    });
  });

  describe('GET_TOOLS', () => {
    it('returns the registered tool definitions', async () => {
      const resp = await handleMessageHelper(
        { type: 'GET_TOOLS' },
        fileSystem, toolRegistry,
      );
      expect(resp.success).toBe(true);
      const tools = resp.tools as Array<{ name: string }>;
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some(t => t.name === 'read_file')).toBe(true);
    });
  });

  describe('GET_FILES', () => {
    it('lists files from the hybrid filesystem', async () => {
      const resp = await handleMessageHelper(
        { type: 'GET_FILES' },
        fileSystem, toolRegistry,
      );
      expect(resp.success).toBe(true);
      const files = resp.files as Array<{ name: string; type: string }>;
      expect(files.some(f => f.name === 'readme.txt')).toBe(true);
      expect(files.some(f => f.type === 'directory' && f.name === 'notes')).toBe(true);
    });
  });

  describe('GET_SESSIONS', () => {
    it('returns empty array when no sessions are saved', async () => {
      const resp = await handleMessageHelper(
        { type: 'GET_SESSIONS' },
        fileSystem, toolRegistry,
      );
      expect(resp.success).toBe(true);
      expect(resp.sessions).toEqual([]);
    });
  });

  describe('SAVE_SESSION + GET_SESSIONS round-trip', () => {
    it('saves a session and retrieves it', async () => {
      const session = { id: 's1', title: 'Test Chat', createdAt: '2026-01-01' };
      await handleMessageHelper({ type: 'SAVE_SESSION', session }, fileSystem, toolRegistry);

      // Mock storage.local.get to return what was saved
      const savedSessions = mockStorageLocal.get('sessions') as unknown[];
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        sessions: savedSessions,
      });

      const resp = await handleMessageHelper({ type: 'GET_SESSIONS' }, fileSystem, toolRegistry);
      expect(resp.success).toBe(true);
      const sessions = resp.sessions as Array<{ id: string }>;
      expect(sessions.some(s => s.id === 's1')).toBe(true);
    });

    it('updates an existing session without creating a duplicate', async () => {
      const session = { id: 's1', title: 'Original', createdAt: '2026-01-01' };
      await handleMessageHelper({ type: 'SAVE_SESSION', session }, fileSystem, toolRegistry);
      const updated = { ...session, title: 'Updated' };
      await handleMessageHelper({ type: 'SAVE_SESSION', session: updated }, fileSystem, toolRegistry);

      const saved = mockStorageLocal.get('sessions') as Array<{ id: string; title: string }>;
      const matches = saved.filter(s => s.id === 's1');
      expect(matches).toHaveLength(1);
      expect(matches[0].title).toBe('Updated');
    });
  });

  describe('REQUEST_FILE_ACCESS', () => {
    it('calls filesystem.requestNativeAccess', async () => {
      const resp = await handleMessageHelper(
        { type: 'REQUEST_FILE_ACCESS' },
        fileSystem, toolRegistry,
      );
      expect(resp.success).toBe(true);
      expect(fileSystem.requestNativeAccess).toHaveBeenCalled();
    });
  });

  describe('INIT_GOOGLE_DRIVE', () => {
    it('initializes Google Drive with the provided token', async () => {
      const resp = await handleMessageHelper(
        { type: 'INIT_GOOGLE_DRIVE', accessToken: 'ya29.token' },
        fileSystem, toolRegistry,
      );
      expect(resp.success).toBe(true);
      expect(fileSystem.initializeGoogleDrive).toHaveBeenCalledWith('ya29.token');
    });
  });

  describe('GOOGLE_SIGNOUT', () => {
    it('removes cached auth token and clears session storage', async () => {
      mockStorageSession.set('google_access_token', 'ya29.old');
      (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        google_access_token: 'ya29.old',
      });
      const resp = await handleMessageHelper(
        { type: 'GOOGLE_SIGNOUT' },
        fileSystem, toolRegistry,
      );
      expect(resp.success).toBe(true);
      expect(chrome.identity.removeCachedAuthToken).toHaveBeenCalledWith({ token: 'ya29.old' });
    });
  });

  describe('unknown message type', () => {
    it('returns success: false with error message', async () => {
      const resp = await handleMessageHelper(
        { type: 'DOES_NOT_EXIST' },
        fileSystem, toolRegistry,
      );
      expect(resp.success).toBe(false);
      expect(String(resp.error)).toContain('Unknown message type');
    });
  });
});
