import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
}

interface TaskEvent {
  type: string;
  taskId?: string;
  event?: {
    type: string;
    thought?: string;
    toolCall?: { name: string; id: string; parameters?: Record<string, unknown> };
    toolResult?: { success: boolean; output?: string; error?: string };
    message?: string;
    state?: string;
  };
  result?: string;
  error?: string;
}

interface PendingConfirmation {
  id: string;
  toolName: string;
  dangerLevel: string;
  description: string;
  parameters: Record<string, unknown>;
  taskId: string;
  timestamp: string;
}

interface Session {
  id: string;
  title: string;
  createdAt: string;
}

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}

interface Tool {
  name: string;
  description: string;
}

type View = 'chat' | 'files' | 'tools' | 'settings';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [confirmations, setConfirmations] = useState<PendingConfirmation[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [currentView, setCurrentView] = useState<View>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('WebSocket connected');
      fetchSessions();
      fetchTools();
      fetchFiles();
    };
    
    websocket.onmessage = (event) => {
      try {
        const data: TaskEvent = JSON.parse(event.data);
        handleWsMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    websocket.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    setWs(websocket);
    
    return () => {
      websocket.close();
    };
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions?limit=10');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e) {}
  };

  const fetchTools = async () => {
    try {
      const res = await fetch('/api/tools');
      const data = await res.json();
      setTools(data.tools || []);
    } catch (e) {}
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e) {}
  };

  const handleWsMessage = useCallback((data: TaskEvent) => {
    if (data.type === 'confirmation_request') {
      const confData = data as { type: string; confirmation: PendingConfirmation };
      const conf = confData.confirmation;
      if (conf) {
        setConfirmations(prev => [...prev, conf]);
      }
      return;
    }
    
    if (['confirmation_approved', 'confirmation_denied', 'confirmation_expired'].includes(data.type)) {
      const confData = data as { type: string; id?: string };
      if (confData.id) {
        setConfirmations(prev => prev.filter(c => c.id !== confData.id));
      }
      return;
    }

    switch (data.type) {
      case 'task_started':
        setStatus('started');
        setIsTyping(true);
        break;
      case 'agent_event':
        if (data.event) {
          if (data.event.type === 'thought' && data.event.thought) {
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: data.event?.thought || '' 
            }]);
          } else if (data.event.type === 'tool_call' && data.event.toolCall) {
            setMessages(prev => [...prev, { 
              role: 'tool', 
              content: `Executing: ${data.event.toolCall.name}`,
              toolName: data.event.toolCall.name
            }]);
          } else if (data.event.type === 'tool_result' && data.event.toolResult) {
            const result = data.event.toolResult;
            const lastMsg = messages[messages.length - 1];
            if (lastMsg?.role === 'tool') {
              setMessages(prev => prev.slice(0, -1));
            }
            setMessages(prev => [...prev, { 
              role: 'system', 
              content: result.success 
                ? (result.output || 'Done') 
                : `Error: ${result.error}` 
            }]);
          } else if (data.event.type === 'state_change') {
            setStatus(data.event.state || '');
            if (data.event.state === 'done' || data.event.state === 'error') {
              setIsTyping(false);
            }
          }
        }
        break;
      case 'task_completed':
        setIsLoading(false);
        setIsTyping(false);
        setStatus('completed');
        break;
      case 'task_error':
        setIsLoading(false);
        setIsTyping(false);
        setStatus('error');
        if (data.error) {
          setMessages(prev => [...prev, { 
            role: 'system', 
            content: `Error: ${data.error}` 
          }]);
        }
        break;
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleApproveConfirmation = async (id: string) => {
    try {
      await fetch(`/api/confirmations/${id}/approve`, { method: 'POST' });
      setConfirmations(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleDenyConfirmation = async (id: string) => {
    try {
      await fetch(`/api/confirmations/${id}/deny`, { method: 'POST' });
      setConfirmations(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to deny:', error);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSession(null);
    setStatus('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStatus('starting');

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'start_task',
        prompt: input
      }));
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      {/* Sidebar */}
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
            {sessions.length === 0 && (
              <p className="no-sessions">No sessions yet</p>
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className={`connection-status ${ws?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {ws?.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {/* Header */}
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
            {isLoading && (
              <div className="processing-indicator">
                <div className="spinner"></div>
                <span>{status || 'Processing...'}</span>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="content">
          {currentView === 'chat' && (
            <>
              <div className="messages-container">
                {messages.length === 0 ? (
                  <div className="welcome-screen">
                    <div className="welcome-icon">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                        <rect width="24" height="24" rx="6" fill="var(--primary)" fillOpacity="0.1"/>
                        <path d="M7 12L10 15L17 8" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h2>Welcome to PixelMate</h2>
                    <p>Your AI assistant that works with files and browsers</p>
                    <div className="quick-actions">
                      <button onClick={() => setInput('List files in my workspace')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                        </svg>
                        Browse Files
                      </button>
                      <button onClick={() => setInput('Search the web for latest AI news')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8"/>
                          <path d="M21 21l-4.35-4.35"/>
                        </svg>
                        Search Web
                      </button>
                      <button onClick={() => setInput('Create a spreadsheet with sample data')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <path d="M14 2v6h6M8 13h8M8 17h8"/>
                        </svg>
                        Create Spreadsheet
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
                      <div className="typing-indicator">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSubmit} className="input-container">
                <div className="input-wrapper">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="What would you like me to do?"
                    disabled={isLoading}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                  <button type="submit" disabled={isLoading || !input.trim()}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                  </button>
                </div>
                <p className="input-hint">Press Enter to send, Shift+Enter for new line</p>
              </form>
            </>
          )}

          {currentView === 'files' && (
            <div className="files-view">
              <div className="files-header">
                <h2>Workspace Files</h2>
                <button className="refresh-btn" onClick={fetchFiles}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6M1 20v-6h6"/>
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                  Refresh
                </button>
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
              <h2>Available Tools</h2>
              <div className="tools-grid">
                {tools.map((tool, i) => (
                  <div key={i} className="tool-card">
                    <div className="tool-name">{tool.name}</div>
                    <p className="tool-desc">{tool.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentView === 'settings' && (
            <div className="settings-view">
              <h2>Settings</h2>
              <div className="settings-section">
                <h3>Connection</h3>
                <div className="setting-item">
                  <span>WebSocket Status</span>
                  <span className={`status-badge ${ws?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected'}`}>
                    {ws?.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="setting-item">
                  <span>Backend URL</span>
                  <code>http://localhost:3001</code>
                </div>
              </div>
              <div className="settings-section">
                <h3>About</h3>
                <div className="setting-item">
                  <span>Version</span>
                  <span>0.1.0</span>
                </div>
                <div className="setting-item">
                  <span>Documentation</span>
                  <a href="/docs" target="_blank">View Docs</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Confirmation Modal */}
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
                <div className="info-row">
                  <label>Tool</label>
                  <code>{conf.toolName}</code>
                </div>
                <div className="info-row">
                  <label>Description</label>
                  <p>{conf.description}</p>
                </div>
                <details className="params-details">
                  <summary>View Parameters</summary>
                  <pre>{JSON.stringify(conf.parameters, null, 2)}</pre>
                </details>
              </div>
              <div className="modal-actions">
                <button className="deny-btn" onClick={() => handleDenyConfirmation(conf.id)}>
                  Deny
                </button>
                <button className="approve-btn" onClick={() => handleApproveConfirmation(conf.id)}>
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
