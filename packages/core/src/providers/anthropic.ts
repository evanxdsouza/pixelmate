import { ChatOptions, ChatResponse, StreamingChunk, LLMProvider, Message } from '@pixelmate/shared';
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  
  name = 'anthropic';

  constructor(apiKey: string) {
    const clientOptions: Record<string, unknown> = {
      apiKey,
      dangerouslyAllowBrowser: true
    };

    this.client = new Anthropic(clientOptions as any);
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const messages = options.messages
      .filter((m: Message) => m.role !== 'system')
      .map((m: Message) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    const systemMessage = options.messages.find((m: Message) => m.role === 'system')?.content || '';

    const response = await this.client.messages.create({
      model: options.model || 'claude-sonnet-4',
      max_tokens: options.maxTokens || 4096,
      system: systemMessage,
      messages: messages
    });

    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('');

    return {
      id: response.id,
      model: response.model,
      content,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0
      }
    };
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<StreamingChunk> {
    const messages = options.messages
      .filter((m: Message) => m.role !== 'system')
      .map((m: Message) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    const systemMessage = options.messages.find((m: Message) => m.role === 'system')?.content || '';

    const stream = this.client.messages.stream({
      model: options.model || 'claude-sonnet-4',
      max_tokens: options.maxTokens || 4096,
      system: systemMessage,
      messages: messages
    });

    let currentId = '';
    for await (const chunk of stream) {
      if (chunk.type === 'message_start' && chunk.message) {
        currentId = chunk.message.id;
      }
      
      if (chunk.type === 'content_block_delta' && chunk.delta) {
        const delta = (chunk.delta as any).text || '';
        yield {
          id: currentId,
          delta,
          done: false
        };
      }
    }

    yield {
      id: currentId,
      delta: '',
      done: true
    };
  }

  async listModels(): Promise<string[]> {
    // Anthropic doesn't have a list models endpoint in the browser SDK
    // Return known models instead
    return [
      'claude-opus-4-1',
      'claude-sonnet-4',
      'claude-haiku-3',
      'claude-3.5-sonnet',
      'claude-3-haiku'
    ];
  }
}
