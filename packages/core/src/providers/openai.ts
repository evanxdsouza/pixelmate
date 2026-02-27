import { ChatOptions, ChatResponse, StreamingChunk, LLMProvider } from '@pixelmate/shared';
import OpenAI from 'openai';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  
  name = 'openai';

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const messages = options.messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content
    }));

    const response = await this.client.chat.completions.create({
      model: options.model || 'gpt-4-turbo-preview',
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      messages: messages
    });

    const content = response.choices[0]?.message?.content || '';

    return {
      id: response.id,
      model: response.model,
      content,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0
      }
    };
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<StreamingChunk> {
    const messages = options.messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content
    }));

    const stream = await this.client.chat.completions.create({
      model: options.model || 'gpt-4-turbo-preview',
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      messages: messages,
      stream: true
    });

    let currentId = '';
    for await (const chunk of stream) {
      if (!currentId && chunk.id) {
        currentId = chunk.id;
      }
      
      const delta = chunk.choices[0]?.delta?.content || '';
      yield {
        id: currentId,
        delta,
        done: false
      };
    }

    yield {
      id: currentId,
      delta: '',
      done: true
    };
  }

  async listModels(): Promise<string[]> {
    const response = await this.client.models.list();
    return response.data
      .filter(m => m.id.includes('gpt'))
      .map(m => m.id);
  }
}
