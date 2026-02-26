export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  messages: Message[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface StreamingChunk {
  id: string;
  delta: string;
  done: boolean;
}

export interface LLMProvider {
  name: string;
  chat(options: ChatOptions): Promise<ChatResponse>;
  chatStream(options: ChatOptions): AsyncGenerator<StreamingChunk>;
  listModels(): Promise<string[]>;
}

export type ProviderType = 'openai' | 'anthropic' | 'groq' | 'google' | 'ollama';
