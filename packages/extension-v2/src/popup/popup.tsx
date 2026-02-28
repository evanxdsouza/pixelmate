import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const STATIC_MODELS: Record<string, string[]> = {
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-sonnet-4', 'claude-haiku-3-5'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o3-mini'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
};

function PopupApp() {
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>(STATIC_MODELS['anthropic']);
  const [loadingModels, setLoadingModels] = useState(false);

  // Load saved provider + model on mount
  useEffect(() => {
    chrome.storage.sync.get(['selected_provider', 'selected_model'], (result) => {
      const savedProvider = (result.selected_provider as string | undefined) || 'anthropic';
      const savedModel = (result.selected_model as string | undefined) || '';
      setProvider(savedProvider);
      setModel(savedModel || STATIC_MODELS[savedProvider]?.[0] || '');
    });
  }, []);

  // Reload API key whenever provider changes
  useEffect(() => {
    chrome.storage.sync.get([`api_key:${provider}`], (result) => {
      setApiKey((result[`api_key:${provider}`] as string) || '');
    });
  }, [provider]);

  // Fetch model list whenever provider changes
  useEffect(() => {
    setLoadingModels(true);
    chrome.runtime.sendMessage({ type: 'GET_MODELS', provider }, (response) => {
      const models: string[] =
        response?.success && Array.isArray(response.models) && response.models.length > 0
          ? response.models
          : STATIC_MODELS[provider] ?? [];
      setAvailableModels(models);
      setModel((prev) => (models.includes(prev) ? prev : models[0] ?? ''));
      setLoadingModels(false);
    });
  }, [provider]);

  const handleSaveSettings = async () => {
    await chrome.storage.sync.set({ [`api_key:${provider}`]: apiKey });
    chrome.runtime.sendMessage({ type: 'SET_PROVIDER', provider, model });
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
              <option value="groq">Groq</option>
            </select>
          </div>

          <div className="settings-group">
            <label>Model{loadingModels ? ' (loading…)' : ''}</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loadingModels}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
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
            <button className="btn-primary" onClick={handleSaveSettings}>
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
      const config = await chrome.storage.sync.get(['selected_provider', 'selected_model']);
      const selectedProvider = (config.selected_provider as string | undefined) || 'anthropic';
      const selectedModel = (config.selected_model as string | undefined) || undefined;

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
        provider: selectedProvider,
        model: selectedModel,
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
