import { ChatOptions, ChatResponse, StreamingChunk, LLMProvider, Message } from '@pixelmate/shared';
import OpenAI from 'openai';

export class GroqProvider implements LLMProvider {
  private client: OpenAI;

  name = 'groq';

  constructor(apiKey: string) {
    const clientOptions: Record<string, unknown> = {
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
      dangerouslyAllowBrowser: true
    };

    this.client = new OpenAI(clientOptions as any);
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const messages = options.messages.map((m: Message) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content
    }));

    const response = await this.client.chat.completions.create({
      model: options.model || 'llama-3.3-70b-versatile',
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      messages
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
    const messages = options.messages.map((m: Message) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content
    }));

    const stream = await this.client.chat.completions.create({
      model: options.model || 'llama-3.3-70b-versatile',
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      messages,
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
    return response.data.map((model) => model.id);
  }
}