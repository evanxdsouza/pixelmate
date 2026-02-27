import '@testing-library/jest-dom';

// Mock chrome API globally for all frontend tests
const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn(),
    connect: vi.fn(),
    lastError: null as { message?: string } | null,
    onMessage: { addListener: vi.fn() },
    onConnect: { addListener: vi.fn() },
  },
  storage: {
    sync: { get: vi.fn(), set: vi.fn() },
    local: { get: vi.fn(), set: vi.fn() },
    session: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  },
  identity: {
    getAuthToken: vi.fn(),
    removeCachedAuthToken: vi.fn(),
  },
  tabs: {
    captureVisibleTab: vi.fn(),
    query: vi.fn(),
  },
};

// @ts-ignore
global.chrome = mockChrome;

// jsdom doesn't implement scrollIntoView — stub it globally
window.HTMLElement.prototype.scrollIntoView = vi.fn();
