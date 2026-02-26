import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface TaskEvent {
  type: string;
  taskId?: string;
  event?: {
    type: string;
    thought?: string;
    toolCall?: { name: string; id: string };
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

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [confirmations, setConfirmations] = useState<PendingConfirmation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect to WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('WebSocket connected');
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

  const handleWsMessage = useCallback((data: TaskEvent) => {
    // Handle confirmation-related messages
    if (data.type === 'confirmation_request') {
      const confData = data as { type: string; confirmation: PendingConfirmation };
      const conf = confData.confirmation;
      if (conf) {
        setConfirmations((prev: PendingConfirmation[]) => [...prev, conf]);
        setMessages(prev => [...prev, {
          role: 'system',
          content: `⚠️ Confirmation required: ${conf.description}`
        }]);
      }
      return;
    }
    
    if (['confirmation_approved', 'confirmation_denied', 'confirmation_expired'].includes(data.type)) {
      const confData = data as { type: string; id?: string };
      if (confData.id) {
        setConfirmations((prev: PendingConfirmation[]) => prev.filter(c => c.id !== confData.id));
      }
      return;
    }

    switch (data.type) {
      case 'task_started':
        setStatus('started');
        break;
      case 'agent_event':
        if (data.event) {
          if (data.event.type === 'thought' && data.event.thought) {
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: data.event?.thought || '' 
            }]);
          } else if (data.event.type === 'tool_result' && data.event.toolResult) {
            const result = data.event.toolResult;
            setMessages(prev => [...prev, { 
              role: 'system', 
              content: result.success 
                ? `Tool executed: ${result.output}` 
                : `Tool error: ${result.error}` 
            }]);
          } else if (data.event.type === 'message' && data.event.message) {
            setMessages(prev => [...prev, { 
              role: 'user', 
              content: data.event?.message || '' 
            }]);
          } else if (data.event.type === 'state_change') {
            setStatus(data.event.state || '');
          }
        }
        break;
      case 'task_completed':
        setIsLoading(false);
        setStatus('completed');
        if (data.result) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Completed: ${data.result}` 
          }]);
        }
        break;
      case 'task_error':
        setIsLoading(false);
        setStatus('error');
        if (data.error) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Error: ${data.error}` 
          }]);
        }
        break;
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Confirmation handlers
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
    } else {
      // Fallback to HTTP if WebSocket not available
      try {
        const response = await fetch('/api/agent/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: input })
        });

        if (!response.ok) {
          throw new Error('Failed to start task');
        }

        const data = await response.json();
        setStatus('running');
        
        // Poll for status
        const pollStatus = setInterval(async () => {
          const statusRes = await fetch(`/api/agent/status/${data.taskId}`);
          const statusData = await statusRes.json();
          
          if (statusData.state === 'done' || statusData.state === 'error') {
            clearInterval(pollStatus);
            setIsLoading(false);
            setStatus(statusData.state);
          }
        }, 2000);
      } catch (error) {
        setIsLoading(false);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Error: Could not connect to backend' 
        }]);
      }
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div>
            <h1>PixelMate</h1>
            <p>Your AI assistant</p>
          </div>
          <div className="status">
            {isLoading && <span className="status-badge processing">Processing</span>}
            {status && !isLoading && <span className="status-badge">{status}</span>}
            {ws?.readyState === WebSocket.OPEN && <span className="ws-badge connected">Live</span>}
          </div>
        </div>
      </header>

      <main className="chat-container">
        <div className="messages">
          {messages.length === 0 && (
            <div className="welcome">
              <h2>Welcome to PixelMate</h2>
              <p>Describe what you want done, and I'll help you accomplish it.</p>
              <div className="examples">
                <p>Try saying:</p>
                <ul>
                  <li>"Read the files in my workspace"</li>
                  <li>"Open Google and search for something"</li>
                  <li>"Create a new file called test.txt"</li>
                </ul>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              {msg.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What would you like me to do?"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? 'Working...' : 'Send'}
          </button>
        </form>
      </main>

      {/* Confirmation Modal */}
      {confirmations.length > 0 && (
        <div className="confirmation-overlay">
          {confirmations.map(conf => (
            <div key={conf.id} className="confirmation-modal">
              <div className="confirmation-header">
                <span className={`danger-badge ${conf.dangerLevel}`}>
                  {conf.dangerLevel.toUpperCase()}
                </span>
                <h3>Confirm Action</h3>
              </div>
              <div className="confirmation-body">
                <p><strong>Tool:</strong> {conf.toolName}</p>
                <p><strong>Description:</strong> {conf.description}</p>
                <details>
                  <summary>View Parameters</summary>
                  <pre>{JSON.stringify(conf.parameters, null, 2)}</pre>
                </details>
              </div>
              <div className="confirmation-actions">
                <button 
                  className="deny-btn"
                  onClick={() => handleDenyConfirmation(conf.id)}
                >
                  Deny
                </button>
                <button 
                  className="approve-btn"
                  onClick={() => handleApproveConfirmation(conf.id)}
                >
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
