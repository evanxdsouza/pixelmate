import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function PopupApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('anthropic');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load saved API key
    chrome.storage.sync.get([`api_key:${provider}`], (result) => {
      const key = result[`api_key:${provider}`] as string;
      if (key) setApiKey(key);
    });
  }, [provider]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    if (!apiKey) {
      setMessages([...messages, { role: 'system', content: 'Please set your API key in settings' }]);
      setShowSettings(true);
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const port = chrome.runtime.connect({ name: 'popup' });
      
      port.onMessage.addListener((message) => {
        if (message.type === 'AGENT_EVENT') {
          const event = message.event;
          if (event.thought) {
            setMessages(prev => [...prev, { role: 'system', content: `💭 ${event.thought.substring(0, 100)}...` }]);
          }
        } else if (message.type === 'AGENT_COMPLETE') {
          setMessages(prev => [...prev, { role: 'assistant', content: message.result }]);
          setLoading(false);
          port.disconnect();
        } else if (message.type === 'ERROR') {
          setMessages(prev => [...prev, { role: 'system', content: `Error: ${message.error}` }]);
          setLoading(false);
          port.disconnect();
        }
      });

      port.postMessage({
        type: 'AGENT_EXECUTE',
        prompt: input,
        model: 'claude-sonnet-4',
        provider
      });
    } catch (error) {
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]);
      setLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    await chrome.storage.sync.set({ [`api_key:${provider}`]: apiKey });
    setShowSettings(false);
  };

  return (
    <div className="popup-header" style={{ position: 'relative', zIndex: 100 }}>
      <div style={{ flex: 1 }}>
        <h1>PixelMate</h1>
      </div>
      <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>
        ⚙️
      </button>

      <div className={`modal ${showSettings ? 'open' : ''}`} style={{ position: 'fixed' }}>
        <div className="modal-content">
          <h2>Settings</h2>
          
          <div className="settings-group">
            <label>LLM Provider</label>
            <select 
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
            </select>
          </div>

          <div className="settings-group">
            <label>API Key ({provider.charAt(0).toUpperCase() + provider.slice(1)})</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key here"
            />
          </div>

          <div className="modal-buttons">
            <button className="btn-secondary" onClick={() => setShowSettings(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSaveApiKey}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PopupUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const port = chrome.runtime.connect({ name: 'popup' });
      
      port.onMessage.addListener((message) => {
        if (message.type === 'AGENT_EVENT') {
          const event = message.event;
          if (event.thought) {
            setMessages(prev => [...prev, { role: 'system', content: `💭 Thinking...` }]);
          }
        } else if (message.type === 'AGENT_COMPLETE') {
          setMessages(prev => [...prev, { role: 'assistant', content: message.result }]);
          setLoading(false);
          port.disconnect();
        } else if (message.type === 'ERROR') {
          setMessages(prev => [...prev, { role: 'system', content: `Error: ${message.error}` }]);
          setLoading(false);
          port.disconnect();
        }
      });

      port.postMessage({
        type: 'AGENT_EXECUTE',
        prompt: input,
        model: 'claude-sonnet-4',
        provider: 'anthropic'
      });
    } catch (error) {
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PopupApp />
      
      <div className="popup-content">
        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              {msg.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask me anything..."
            disabled={loading}
          />
          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={loading || !input.trim()}
          >
            {loading ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<PopupUI />);
