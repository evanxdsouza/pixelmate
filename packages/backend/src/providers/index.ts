import { LLMProvider, ProviderType, ChatOptions, ChatResponse, StreamingChunk, Message } from './types.js';

export type { Message } from './types.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';

export class ProviderFactory {
  private static providers: Map<ProviderType, LLMProvider> = new Map();

  static getProvider(type: ProviderType, apiKey?: string): LLMProvider {
    if (this.providers.has(type)) {
      return this.providers.get(type)!;
    }

    let provider: LLMProvider;
    switch (type) {
      case 'openai':
        provider = new OpenAIProvider(apiKey);
        break;
      case 'anthropic':
        provider = new AnthropicProvider(apiKey);
        break;
      case 'groq':
        provider = new OpenAIProvider(apiKey || process.env.GROQ_API_KEY);
        break;
      case 'google':
        provider = new OpenAIProvider(apiKey || process.env.GOOGLE_API_KEY);
        break;
      case 'ollama':
        provider = new OpenAIProvider(apiKey || 'http://localhost:11434');
        break;
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }

    this.providers.set(type, provider);
    return provider;
  }

  static clearCache(): void {
    this.providers.clear();
  }
}

export class LLMClient {
  private provider: LLMProvider;

  constructor(type: ProviderType, apiKey?: string) {
    this.provider = ProviderFactory.getProvider(type, apiKey);
  }

  setProvider(type: ProviderType, apiKey?: string): void {
    this.provider = ProviderFactory.getProvider(type, apiKey);
  }

  async chat(options: { messages: ChatOptions['messages']; temperature?: number; maxTokens?: number; stream?: boolean; model?: string }): Promise<ChatResponse> {
    const model = options.model || this.getDefaultModel();
    return this.provider.chat({ messages: options.messages, temperature: options.temperature, maxTokens: options.maxTokens, model });
  }

  async *chatStream(options: { messages: ChatOptions['messages']; temperature?: number; maxTokens?: number; stream?: boolean; model?: string }): AsyncGenerator<StreamingChunk> {
    const model = options.model || this.getDefaultModel();
    yield* this.provider.chatStream({ messages: options.messages, temperature: options.temperature, maxTokens: options.maxTokens, model });
  }

  async listModels(): Promise<string[]> {
    return this.provider.listModels();
  }

  private getDefaultModel(): string {
    if (this.provider.name === 'anthropic') {
      return 'claude-sonnet-4-5-20250501';
    }
    return 'gpt-4o';
  }
}
