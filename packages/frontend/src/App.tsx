import { useState, useEffect, useCallback, useRef } from 'react';
import { bridge, AgentEvent, FileMeta, Session, ToolMeta, OnConfirmCallback } from './services/ExtensionBridge';

interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolName?: string;
}

interface PendingConfirmation {
  id: string;       // React key (same as confirmId)
  confirmId: string; // opaque ID sent back to background
  toolName: string;
  description: string;
  parameters: Record<string, unknown>;
  dangerLevel: 'low' | 'medium' | 'high';
}

type View = 'chat' | 'files' | 'tools' | 'settings';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolMeta[]>([]);
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [currentView, setCurrentView] = useState<View>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [confirmations, setConfirmations] = useState<PendingConfirmation[]>([]);
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [settingsApiKey, setSettingsApiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [saveKeyStatus, setSaveKeyStatus] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ChromeOS keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      // Ctrl+Enter — submit current message
      if (ctrl && e.key === 'Enter') {
        e.preventDefault();
        if (!isLoading && input.trim()) {
          document.querySelector<HTMLFormElement>('.chat-form')?.requestSubmit();
        }
      }
      // Ctrl+Shift+N — new chat
      if (ctrl && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        handleNewChat();
      }
      // Ctrl+K — focus the chat input
      if (ctrl && e.key === 'k') {
        e.preventDefault();
        setCurrentView('chat');
        inputRef.current?.focus();
      }
      // Ctrl+, — open settings
      if (ctrl && e.key === ',') {
        e.preventDefault();
        setCurrentView('settings');
      }
      // Escape — cancel running agent or dismiss confirmation
      if (e.key === 'Escape') {
        if (confirmations.length > 0) return; // let confirmation handle it
        if (isLoading) {
          cancelRef.current?.();
          setIsLoading(false);
          setIsTyping(false);
          setStatus('');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLoading, input, confirmations]);

  useEffect(() => {
    const available = bridge.isAvailable();
    setExtensionAvailable(available);

    if (available) {
      fetchSessions();
      fetchTools();
      bridge.getConfig(['selected_provider', 'selected_model']).then((cfg) => {
        const p = cfg.selected_provider ? String(cfg.selected_provider) : 'anthropic';
        const m = cfg.selected_model ? String(cfg.selected_model) : '';
        setProvider(p);
        fetchModels(p, m);
      }).catch(() => { fetchModels('anthropic'); });
    }
  }, []);

  const fetchSessions = async () => {
    try { setSessions(await bridge.getSessions()); } catch (_) {}
  };

  const fetchTools = async () => {
    try { setTools(await bridge.getTools()); } catch (_) {}
  };

  const fetchFiles = async () => {
    try { setFiles(await bridge.getFiles()); } catch (_) {}
  };

  const fetchModels = async (p: string, preferModel = '') => {
    setLoadingModels(true);
    try {
      const list = await bridge.getModels(p);
      setModels(list);
      setModel(list.includes(preferModel) && preferModel ? preferModel : (list[0] ?? ''));
    } catch (_) {
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAgentEvent = useCallback((event: AgentEvent) => {
    if (event.type === 'thought' && event.thought) {
      setMessages(prev => [...prev, { role: 'assistant', content: event.thought! }]);
    } else if (event.type === 'tool_call' && event.toolCall) {
      setMessages(prev => [...prev, {
        role: 'tool',
        content: `Executing: ${event.toolCall!.name}`,
        toolName: event.toolCall!.name,
      }]);
    } else if (event.type === 'tool_result' && event.toolResult) {
      const result = event.toolResult;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        const base = last?.role === 'tool' ? prev.slice(0, -1) : prev;
        return [...base, {
          role: 'system',
          content: result.success ? (result.output || 'Done') : `Error: ${result.error}`,
        }];
      });
    } else if (event.type === 'state_change') {
      setStatus(event.state || '');
      if (event.state === 'done' || event.state === 'error') setIsTyping(false);
    } else if (event.type === 'error' && event.error) {
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${event.error}` }]);
      setIsTyping(false);
      setIsLoading(false);
    }
  }, []);

  const handleNewChat = () => {
    cancelRef.current?.();
    setMessages([]);
    setCurrentSession(null);
    setStatus('');
    setIsLoading(false);
    setIsTyping(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!extensionAvailable) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'PixelMate extension is not detected. Please install it and reload this page.',
      }]);
      return;
    }

    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);
    setStatus('starting');

    const sessionId = currentSession ?? `session-${Date.now()}`;
    if (!currentSession) {
      setCurrentSession(sessionId);
      const s: Session = { id: sessionId, title: userMsg.content.slice(0, 60), createdAt: new Date().toISOString() };
      setSessions(prev => [s, ...prev]);
      bridge.saveSession(s).catch(() => {});
    }

    const onConfirmRequired: OnConfirmCallback = (confirmId, toolName, params, dangerLevel, description) => {
      setConfirmations(prev => [
        ...prev,
        {
          id: confirmId,
          confirmId,
          toolName,
          description,
          parameters: params,
          dangerLevel: (dangerLevel as PendingConfirmation['dangerLevel']) ?? 'medium',
        },
      ]);
    };

    cancelRef.current = bridge.executeAgent(
      userMsg.content,
      { provider, model: model || undefined, skill: currentSkill || undefined },
      handleAgentEvent,
      (result) => {
        setMessages(prev => [...prev, { role: 'assistant', content: result }]);
        setIsLoading(false);
        setIsTyping(false);
        setStatus('done');
      },
      (error) => {
        setMessages(prev => [...prev, { role: 'system', content: `Error: ${error}` }]);
        setIsLoading(false);
        setIsTyping(false);
        setStatus('error');
      },
      onConfirmRequired
    );
  };

  const handleSaveApiKey = async () => {
    if (!settingsApiKey.trim()) return;
    setIsSavingKey(true);
    try {
      await bridge.setApiKey(provider, settingsApiKey.trim());
      setSaveKeyStatus('Saved!');
      setSettingsApiKey('');
    } catch {
      setSaveKeyStatus('Failed to save key');
    } finally {
      setIsSavingKey(false);
      setTimeout(() => setSaveKeyStatus(''), 3000);
    }
  };

  const handleGoogleSignIn = async () => {
    try { await bridge.googleSignIn(); setGoogleConnected(true); } catch (err) { console.error(err); }
  };

  const handleGoogleSignOut = async () => {
    try { await bridge.googleSignOut(); setGoogleConnected(false); } catch (_) {}
  };

  const handleRequestFileAccess = async () => {
    try { await bridge.requestFileAccess(); } catch (err) { console.error(err); }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'thinking': return 'var(--accent)';
      case 'acting': return 'var(--warning)';
      case 'done': return 'var(--success)';
      case 'error': return 'var(--error)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="var(--primary)"/>
              <path d="M7 12L10 15L17 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>PixelMate</span>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarOpen ? <path d="M15 18l-6-6 6-6"/> : <path d="M9 18l6-6-6-6"/>}
            </svg>
          </button>
        </div>

        <button className="new-chat-btn" onClick={handleNewChat}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Chat
        </button>

        <nav className="sidebar-nav">
          <button className={`nav-btn ${currentView === 'chat' ? 'active' : ''}`} onClick={() => setCurrentView('chat')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            Chat
          </button>
          <button className={`nav-btn ${currentView === 'files' ? 'active' : ''}`} onClick={() => { setCurrentView('files'); fetchFiles(); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            Files
          </button>
          <button className={`nav-btn ${currentView === 'tools' ? 'active' : ''}`} onClick={() => setCurrentView('tools')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
            </svg>
            Tools
          </button>
          <button className={`nav-btn ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setCurrentView('settings')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            Settings
          </button>
        </nav>

        <div className="sessions-section">
          <h3>Recent Sessions</h3>
          <div className="sessions-list">
            {sessions.map(session => (
              <button
                key={session.id}
                className={`session-item ${currentSession === session.id ? 'active' : ''}`}
                onClick={() => setCurrentSession(session.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                <span>{session.title || 'New Chat'}</span>
              </button>
            ))}
            {sessions.length === 0 && <p className="no-sessions">No sessions yet</p>}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className={`connection-status ${extensionAvailable ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {extensionAvailable ? 'Extension active' : 'Extension not found'}
          </div>
          {googleConnected && (
            <div className="connection-status connected" style={{ marginTop: 4 }}>
              <span className="status-dot"></span>Google Drive
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="main-header">
          <div className="header-left">
            {!sidebarOpen && (
              <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h18M3 6h18M3 18h18"/>
                </svg>
              </button>
            )}
            <h1>
              {currentView === 'chat' && 'Chat'}
              {currentView === 'files' && 'Files'}
              {currentView === 'tools' && 'Tools'}
              {currentView === 'settings' && 'Settings'}
            </h1>
          </div>
          <div className="header-right">
            {currentView === 'chat' && (
              <div className="skill-selector">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <select
                  value={currentSkill}
                  onChange={e => setCurrentSkill(e.target.value)}
                  title="Select a skill / mode"
                >
                  <option value="">General assistant</option>
                  <optgroup label="Developer">
                    <option value="code">Code</option>
                    <option value="debug">Debug</option>
                  </optgroup>
                  <optgroup label="Content">
                    <option value="document">Document</option>
                    <option value="email">Email</option>
                    <option value="presentation">Presentation</option>
                    <option value="podcast">Podcast</option>
                  </optgroup>
                  <optgroup label="Data">
                    <option value="spreadsheet">Spreadsheet</option>
                    <option value="research">Research</option>
                  </optgroup>
                  <optgroup label="Professional">
                    <option value="business">Business</option>
                    <option value="meeting">Meeting</option>
                    <option value="admin">Admin</option>
                  </optgroup>
                  <optgroup label="Learning">
                    <option value="student">Student</option>
                  </optgroup>
                </select>
              </div>
            )}
            {isLoading && (
              <div className="processing-indicator">
                <div className="spinner"></div>
                <span style={{ color: getStatusColor() }}>{status || 'Processing...'}</span>
              </div>
            )}
          </div>
        </header>

        <div className="content">
          {currentView === 'chat' && (
            <>
              {!extensionAvailable && (
                <div className="extension-banner">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  PixelMate extension not detected. Install it and reload to enable full functionality.
                </div>
              )}
              <div className="messages-container">
                {messages.length === 0 && (
                  <div className="welcome-screen">
                    <div className="welcome-icon">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                        <rect width="24" height="24" rx="6" fill="var(--primary)" fillOpacity="0.1"/>
                        <path d="M7 12L10 15L17 8" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h2>Welcome to PixelMate</h2>
                    <p>Pick a scenario below, or choose a skill from the header and start chatting</p>
                    <div className="quick-actions">
                      {/* Developer */}
                      <button onClick={() => { setCurrentSkill('debug'); setInput('I have a bug. Here is the error:\n\n'); inputRef.current?.focus(); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                          <path d="M9 9h.01M15 9h.01M8 13s1 2 4 2 4-2 4-2"/>
                        </svg>
                        Debug an error
                      </button>
                      <button onClick={() => { setCurrentSkill('code'); setInput('Review and refactor this code:\n\n'); inputRef.current?.focus(); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="16 18 22 12 16 6"/>
                          <polyline points="8 6 2 12 8 18"/>
                        </svg>
                        Review & refactor code
                      </button>
                      <button onClick={() => { setCurrentSkill('code'); setInput('Generate unit tests for this code:\n\n'); inputRef.current?.focus(); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        Generate tests
                      </button>
                      {/* Research & Content */}
                      <button onClick={() => { setCurrentSkill('research'); setInput('Research this topic thoroughly and save a report:\n\n'); inputRef.current?.focus(); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8"/>
                          <path d="M21 21l-4.35-4.35"/>
                        </svg>
                        Research a topic
                      </button>
                      <button onClick={() => { setCurrentSkill('document'); setInput('Convert this script/transcript into a polished blog post:\n\n'); inputRef.current?.focus(); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                        Write blog post
                      </button>
                      <button onClick={() => { setCurrentSkill('podcast'); setInput('Create show notes for this podcast episode:\n\nTitle: \nGuest: \nTopics covered:\n'); inputRef.current?.focus(); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z"/>
                          <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                          <line x1="12" y1="19" x2="12" y2="22"/>
                        </svg>
                        Podcast show notes
                      </button>
                      {/* Business */}
                      <button onClick={() => { setCurrentSkill('meeting'); setInput('Summarise these meeting notes and extract action items:\n\n'); inputRef.current?.focus(); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        Meeting summary
                      </button>
                      <button onClick={() => { setCurrentSkill('business'); setInput('Write a business proposal for:\n\nClient: \nObjective: \n'); inputRef.current?.focus(); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
                          <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
                        </svg>
                        Write proposal
                      </button>
                      {/* Files & Data */}
                      <button onClick={() => setInput('List files in my workspace')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                        </svg>
                        Browse files
                      </button>
                      <button onClick={() => { setCurrentSkill('spreadsheet'); setInput('Create a spreadsheet with sample data for:\n\n'); inputRef.current?.focus(); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <path d="M14 2v6h6M8 13h8M8 17h8"/>
                        </svg>
                        Create spreadsheet
                      </button>
                      {/* Learning */}
                      <button onClick={() => { setCurrentSkill('student'); setInput('Explain this concept clearly and create study notes:\n\n'); inputRef.current?.focus(); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
                          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
                        </svg>
                        Study notes
                      </button>
                      {/* Admin */}
                      <button onClick={() => { setCurrentSkill('admin'); setInput('Organise my workspace files. List what is there and suggest a folder structure.'); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                        Organise files
                      </button>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === 'user' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                      ) : msg.role === 'tool' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <rect width="24" height="24" rx="6" fill="var(--primary)"/>
                          <path d="M7 12L10 15L17 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div className="message-content">
                      {msg.toolName && <span className="tool-badge">{msg.toolName}</span>}
                      <div className="message-text">{msg.content}</div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="message assistant">
                    <div className="message-avatar">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <rect width="24" height="24" rx="6" fill="var(--primary)"/>
                        <path d="M7 12L10 15L17 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="message-content">
                      <div className="typing-indicator"><span></span><span></span><span></span></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-form input-container" onSubmit={handleSubmit}>
                {currentSkill && (
                  <div className="active-skill-badge">
                    <span>Mode: {currentSkill}</span>
                    <button type="button" onClick={() => setCurrentSkill('')} title="Clear skill mode">×</button>
                  </div>
                )}
                <div className="input-wrapper">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="What would you like me to do?"
                    disabled={isLoading}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
                    }}
                  />
                  <button type="submit" disabled={isLoading || !input.trim()}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                  </button>
                </div>
                <p className="input-hint">Enter to send · Shift+Enter for new line · Ctrl+K to focus · Ctrl+Shift+N new chat</p>
              </form>
            </>
          )}

          {currentView === 'files' && (
            <div className="files-view">
              <div className="files-header">
                <h2>Workspace Files</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="refresh-btn" onClick={handleRequestFileAccess}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                    </svg>
                    Grant Access
                  </button>
                  <button className="refresh-btn" onClick={fetchFiles}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6M1 20v-6h6"/>
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>
              <div className="files-grid">
                {files.map((file, i) => (
                  <div key={i} className="file-card">
                    <div className="file-icon">
                      {file.type === 'directory' ? (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--warning)" stroke="none">
                          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                        </svg>
                      ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                        </svg>
                      )}
                    </div>
                    <div className="file-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-meta">
                        {file.type === 'directory' ? 'Folder' : file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'File'}
                      </span>
                    </div>
                  </div>
                ))}
                {files.length === 0 && (
                  <div className="empty-state">
                    <p>No files in workspace</p>
                    <p className="hint">Files you create will appear here</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'tools' && (
            <div className="tools-view">
              <h2>Available Tools ({tools.length})</h2>
              <div className="tools-grid">
                {tools.map((tool, i) => (
                  <div key={i} className="tool-card">
                    <div className="tool-name">{tool.name}</div>
                    <p className="tool-desc">{tool.description}</p>
                  </div>
                ))}
                {tools.length === 0 && (
                  <div className="empty-state">
                    <p>No tools loaded</p>
                    <p className="hint">Make sure the extension is active</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'settings' && (
            <div className="settings-view">
              <h2>Settings</h2>

              <div className="settings-section">
                <h3>AI Provider</h3>
                <div className="setting-item">
                  <label htmlFor="provider-select">Provider</label>
                  <select
                    id="provider-select"
                    value={provider}
                    onChange={(e) => {
                      const p = e.target.value;
                      setProvider(p);
                      setModel('');
                      fetchModels(p);
                      bridge.setProvider(p, '').catch(() => {});
                    }}
                  >
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="groq">Groq (Llama / Mixtral)</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label htmlFor="model-select">Model</label>
                  <select
                    id="model-select"
                    value={model}
                    onChange={(e) => {
                      const m = e.target.value;
                      setModel(m);
                      bridge.setProvider(provider, m).catch(() => {});
                    }}
                    disabled={loadingModels || models.length === 0}
                    style={{ minWidth: 200 }}
                  >
                    {loadingModels && <option value="">Loading models…</option>}
                    {models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {!loadingModels && models.length === 0 && (
                      <option value="">No models available</option>
                    )}
                  </select>
                </div>
                <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                  <label>API Key for {provider}</label>
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <input
                      type="password"
                      placeholder={`Enter ${provider} API key…`}
                      value={settingsApiKey}
                      onChange={(e) => setSettingsApiKey(e.target.value)}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)' }}
                    />
                    <button onClick={handleSaveApiKey} disabled={isSavingKey || !settingsApiKey.trim()} className="approve-btn">
                      {isSavingKey ? 'Saving…' : 'Save Key'}
                    </button>
                  </div>
                  {saveKeyStatus && <span style={{ fontSize: 12, color: 'var(--success)' }}>{saveKeyStatus}</span>}
                </div>
              </div>

              <div className="settings-section">
                <h3>Google Workspace</h3>
                <div className="setting-item">
                  <span>Google Drive &amp; Docs</span>
                  {googleConnected
                    ? <button className="deny-btn" onClick={handleGoogleSignOut}>Sign Out</button>
                    : <button className="approve-btn" onClick={handleGoogleSignIn}>Connect Google</button>
                  }
                </div>
              </div>

              <div className="settings-section">
                <h3>Local Files</h3>
                <div className="setting-item">
                  <span>Native filesystem access</span>
                  <button className="approve-btn" onClick={handleRequestFileAccess}>Grant Access</button>
                </div>
              </div>

              <div className="settings-section">
                <h3>Extension</h3>
                <div className="setting-item">
                  <span>Status</span>
                  <span className={`status-badge ${extensionAvailable ? 'connected' : 'disconnected'}`}>
                    {extensionAvailable ? 'Active' : 'Not found'}
                  </span>
                </div>
              </div>

              <div className="settings-section">
                <h3>About</h3>
                <div className="setting-item"><span>Version</span><span>0.1.0</span></div>
                <div className="setting-item">
                  <span>Documentation</span>
                  <a href="/docs" target="_blank" rel="noreferrer">View Docs</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {confirmations.length > 0 && (
        <div className="modal-overlay">
          {confirmations.map(conf => (
            <div key={conf.id} className="confirmation-modal">
              <div className="modal-header">
                <div className={`danger-indicator ${conf.dangerLevel}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div>
                  <h3>Confirm Action</h3>
                  <span className={`danger-level ${conf.dangerLevel}`}>{conf.dangerLevel} risk</span>
                </div>
              </div>
              <div className="modal-body">
                <div className="info-row"><label>Tool</label><code>{conf.toolName}</code></div>
                <div className="info-row"><label>Description</label><p>{conf.description}</p></div>
                <details className="params-details">
                  <summary>View Parameters</summary>
                  <pre>{JSON.stringify(conf.parameters, null, 2)}</pre>
                </details>
              </div>
              <div className="modal-actions">
                <button className="deny-btn" onClick={() => {
                  bridge.sendConfirmResponse(conf.confirmId, false);
                  setConfirmations(prev => prev.filter(c => c.id !== conf.id));
                }}>Deny</button>
                <button className="approve-btn" onClick={() => {
                  bridge.sendConfirmResponse(conf.confirmId, true);
                  setConfirmations(prev => prev.filter(c => c.id !== conf.id));
                }}>Approve</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
