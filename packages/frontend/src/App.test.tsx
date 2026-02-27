import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock the ExtensionBridge singleton
vi.mock('./services/ExtensionBridge', () => {
  const mockBridge = {
    isAvailable: vi.fn().mockReturnValue(false),
    getConfig: vi.fn().mockResolvedValue({}),
    getSessions: vi.fn().mockResolvedValue([]),
    getTools: vi.fn().mockResolvedValue([]),
    getFiles: vi.fn().mockResolvedValue([]),
    setApiKey: vi.fn().mockResolvedValue(undefined),
    saveSession: vi.fn().mockResolvedValue(undefined),
    googleSignIn: vi.fn().mockResolvedValue('ya29.test'),
    googleSignOut: vi.fn().mockResolvedValue(undefined),
    requestFileAccess: vi.fn().mockResolvedValue(undefined),
    executeAgent: vi.fn().mockReturnValue(() => {}),
    disconnect: vi.fn(),
  };
  return {
    bridge: mockBridge,
    ExtensionBridge: vi.fn(() => mockBridge),
  };
});

describe('App component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText('PixelMate')).toBeTruthy();
  });

  it('shows "Extension not found" when extension is unavailable', () => {
    render(<App />);
    expect(screen.getByText(/extension not found/i)).toBeTruthy();
  });

  it('shows extension-not-detected banner in chat view', () => {
    render(<App />);
    expect(screen.getByText(/extension not detected/i)).toBeTruthy();
  });

  it('renders the sidebar navigation buttons', () => {
    render(<App />);
    // 'Chat' appears in both nav button and page header, so use role query
    expect(screen.getByRole('button', { name: /^chat$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^files$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^tools$/i })).toBeTruthy();
    expect(screen.getAllByText(/^settings$/i).length).toBeGreaterThan(0);
  });

  it('renders the New Chat button', () => {
    render(<App />);
    expect(screen.getByText('New Chat')).toBeTruthy();
  });

  it('renders the welcome screen on initial chat view', () => {
    render(<App />);
    expect(screen.getByText('Welcome to PixelMate')).toBeTruthy();
  });

  it('shows the message input area', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/what would you like me to do/i)).toBeTruthy();
  });

  it('switches to the Settings view when Settings nav button is clicked', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Settings'));
    await waitFor(() => {
      expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
      expect(screen.getByText('AI Provider')).toBeTruthy();
    });
  });

  it('switches to the Tools view and shows empty state', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Tools'));
    await waitFor(() => {
      expect(screen.getByText(/No tools loaded/i)).toBeTruthy();
    });
  });

  it('shows a warning when trying to submit without extension', async () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText(/what would you like me to do/i);
    await userEvent.type(textarea, 'Hello');
    fireEvent.submit(textarea.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/extension is not detected/i)).toBeTruthy();
    });
  });

  it('New Chat clears messages and session', async () => {
    render(<App />);
    // Submit to create message
    const textarea = screen.getByPlaceholderText(/what would you like me to do/i);
    await userEvent.type(textarea, 'Hello AI');
    fireEvent.submit(textarea.closest('form')!);
    // Click New Chat
    fireEvent.click(screen.getByText('New Chat'));
    // Welcome screen should reappear
    await waitFor(() => {
      expect(screen.getByText('Welcome to PixelMate')).toBeTruthy();
    });
  });

  it('shows Quick Action buttons on welcome screen', () => {
    render(<App />);
    expect(screen.getByText('Browse Files')).toBeTruthy();
    expect(screen.getByText('Search Web')).toBeTruthy();
    expect(screen.getByText('Create Spreadsheet')).toBeTruthy();
  });

  it('Quick Action populates the input', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Browse Files'));
    const textarea = screen.getByPlaceholderText(/what would you like me to do/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('files');
  });

  it('settings view shows provider dropdown', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Settings'));
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select).toBeTruthy();
    });
  });
});
