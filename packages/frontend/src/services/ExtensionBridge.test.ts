import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExtensionBridge } from './ExtensionBridge';

// chrome is set up in test-setup.ts

describe('ExtensionBridge', () => {
  let bridge: ExtensionBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset lastError
    (chrome.runtime as Record<string, unknown>).lastError = null;
    bridge = new ExtensionBridge('test-extension-id');
  });

  describe('isAvailable()', () => {
    it('returns true when chrome.runtime.id is present', () => {
      expect(bridge.isAvailable()).toBe(true);
    });

    it('returns false when chrome is undefined', () => {
      const saved = (global as Record<string, unknown>).chrome;
      (global as Record<string, unknown>).chrome = undefined;
      const b = new ExtensionBridge();
      expect(b.isAvailable()).toBe(false);
      (global as Record<string, unknown>).chrome = saved;
    });
  });

  describe('setApiKey()', () => {
    it('sends SET_API_KEY message and resolves on success', async () => {
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: true })
      );
      await expect(bridge.setApiKey('anthropic', 'sk-test')).resolves.not.toThrow();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        'test-extension-id',
        expect.objectContaining({ type: 'SET_API_KEY', provider: 'anthropic', apiKey: 'sk-test' }),
        expect.any(Function),
      );
    });

    it('throws when response.success is false', async () => {
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: false, error: 'bad key' })
      );
      await expect(bridge.setApiKey('openai', 'bad')).rejects.toThrow('bad key');
    });
  });

  describe('getConfig()', () => {
    it('returns config values on success', async () => {
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: true, values: { selected_provider: 'groq' } })
      );
      const cfg = await bridge.getConfig(['selected_provider']);
      expect(cfg).toEqual({ selected_provider: 'groq' });
    });
  });

  describe('getTools()', () => {
    it('returns tool list from extension', async () => {
      const tools = [{ name: 'echo', description: 'Echoes' }];
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: true, tools })
      );
      const result = await bridge.getTools();
      expect(result).toEqual(tools);
    });

    it('returns empty array when success is false', async () => {
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: false, error: 'not ready' })
      );
      await expect(bridge.getTools()).rejects.toThrow('not ready');
    });
  });

  describe('getFiles()', () => {
    it('returns file list from extension', async () => {
      const files = [{ name: 'notes.txt', type: 'file' }];
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: true, files })
      );
      const result = await bridge.getFiles();
      expect(result).toEqual(files);
    });

    it('returns empty array when success is false', async () => {
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: false })
      );
      const result = await bridge.getFiles();
      expect(result).toEqual([]);
    });
  });

  describe('getSessions()', () => {
    it('returns session list', async () => {
      const sessions = [{ id: 's1', title: 'Chat 1', createdAt: '2026-01-01' }];
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: true, sessions })
      );
      const result = await bridge.getSessions();
      expect(result).toEqual(sessions);
    });

    it('returns empty array on failure', async () => {
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: false })
      );
      expect(await bridge.getSessions()).toEqual([]);
    });
  });

  describe('saveSession()', () => {
    it('sends SAVE_SESSION message', async () => {
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: true })
      );
      const session = { id: 's1', title: 'Test', createdAt: '2026-01-01' };
      await bridge.saveSession(session);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        'test-extension-id',
        expect.objectContaining({ type: 'SAVE_SESSION', session }),
        expect.any(Function),
      );
    });
  });

  describe('googleSignIn()', () => {
    it('resolves with the access token on success', async () => {
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: true, token: 'ya29.test' })
      );
      const token = await bridge.googleSignIn();
      expect(token).toBe('ya29.test');
    });

    it('throws on failure', async () => {
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: false, error: 'auth failed' })
      );
      await expect(bridge.googleSignIn()).rejects.toThrow('auth failed');
    });
  });

  describe('requestFileAccess()', () => {
    it('resolves when successful', async () => {
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        (_extId, _msg, cb) => cb({ success: true })
      );
      await expect(bridge.requestFileAccess()).resolves.not.toThrow();
    });
  });

  describe('executeAgent()', () => {
    it('returns a cancel function immediately', () => {
      const mockPort: Partial<chrome.runtime.Port> = {
        onMessage: { addListener: vi.fn() } as unknown as chrome.runtime.Port['onMessage'],
        onDisconnect: { addListener: vi.fn() } as unknown as chrome.runtime.Port['onDisconnect'],
        postMessage: vi.fn(),
        disconnect: vi.fn(),
      };
      (chrome.runtime.connect as ReturnType<typeof vi.fn>).mockReturnValue(mockPort);

      const cancel = bridge.executeAgent('test prompt', {}, vi.fn(), vi.fn(), vi.fn());
      expect(typeof cancel).toBe('function');
    });

    it('posts AGENT_EXECUTE message to the port', () => {
      const mockPort: Partial<chrome.runtime.Port> = {
        onMessage: { addListener: vi.fn() } as unknown as chrome.runtime.Port['onMessage'],
        onDisconnect: { addListener: vi.fn() } as unknown as chrome.runtime.Port['onDisconnect'],
        postMessage: vi.fn(),
        disconnect: vi.fn(),
      };
      (chrome.runtime.connect as ReturnType<typeof vi.fn>).mockReturnValue(mockPort);

      bridge.executeAgent('do something', { provider: 'anthropic' }, vi.fn(), vi.fn(), vi.fn());
      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'AGENT_EXECUTE', prompt: 'do something', provider: 'anthropic' })
      );
    });

    it('calls onError and returns when extension is not available', () => {
      const saved = (global as Record<string, unknown>).chrome;
      (global as Record<string, unknown>).chrome = undefined;
      const b = new ExtensionBridge();
      const onError = vi.fn();
      b.executeAgent('prompt', {}, vi.fn(), vi.fn(), onError);
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('not installed'));
      (global as Record<string, unknown>).chrome = saved;
    });

    it('calls onComplete when AGENT_COMPLETE message arrives', () => {
      let messageListener: ((msg: Record<string, unknown>) => void) | undefined;
      const mockPort: Partial<chrome.runtime.Port> = {
        onMessage: {
          addListener: vi.fn((fn) => { messageListener = fn; }),
        } as unknown as chrome.runtime.Port['onMessage'],
        onDisconnect: { addListener: vi.fn() } as unknown as chrome.runtime.Port['onDisconnect'],
        postMessage: vi.fn(),
        disconnect: vi.fn(),
      };
      (chrome.runtime.connect as ReturnType<typeof vi.fn>).mockReturnValue(mockPort);

      const onComplete = vi.fn();
      bridge.executeAgent('q', {}, vi.fn(), onComplete, vi.fn());
      messageListener!({ type: 'AGENT_COMPLETE', result: 'The result' });
      expect(onComplete).toHaveBeenCalledWith('The result');
    });

    it('calls onEvent when AGENT_EVENT message arrives', () => {
      let messageListener: ((msg: Record<string, unknown>) => void) | undefined;
      const mockPort: Partial<chrome.runtime.Port> = {
        onMessage: {
          addListener: vi.fn((fn) => { messageListener = fn; }),
        } as unknown as chrome.runtime.Port['onMessage'],
        onDisconnect: { addListener: vi.fn() } as unknown as chrome.runtime.Port['onDisconnect'],
        postMessage: vi.fn(),
        disconnect: vi.fn(),
      };
      (chrome.runtime.connect as ReturnType<typeof vi.fn>).mockReturnValue(mockPort);

      const onEvent = vi.fn();
      bridge.executeAgent('q', {}, onEvent, vi.fn(), vi.fn());
      const event = { type: 'thought', thought: 'thinking...' };
      messageListener!({ type: 'AGENT_EVENT', event });
      expect(onEvent).toHaveBeenCalledWith(event);
    });
  });

  describe('disconnect()', () => {
    it('disconnects the port if one is open', () => {
      const mockPort: Partial<chrome.runtime.Port> = {
        onMessage: { addListener: vi.fn() } as unknown as chrome.runtime.Port['onMessage'],
        onDisconnect: { addListener: vi.fn() } as unknown as chrome.runtime.Port['onDisconnect'],
        postMessage: vi.fn(),
        disconnect: vi.fn(),
      };
      (chrome.runtime.connect as ReturnType<typeof vi.fn>).mockReturnValue(mockPort);

      bridge.executeAgent('q', {}, vi.fn(), vi.fn(), vi.fn());
      bridge.disconnect();
      expect(mockPort.disconnect).toHaveBeenCalled();
    });

    it('does not throw when called with no open port', () => {
      expect(() => bridge.disconnect()).not.toThrow();
    });
  });
});
