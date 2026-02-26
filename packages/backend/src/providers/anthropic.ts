import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, ChatOptions, ChatResponse, StreamingChunk } from './types.js';

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY
    });
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const systemMessage = options.messages.find(m => m.role === 'system');
    const conversationMessages = options.messages.filter(m => m.role !== 'system');

    const response = await this.client.messages.create({
      model: options.model,
      system: systemMessage?.content,
      messages: conversationMessages as Anthropic.MessageParam[],
      temperature: options.temperature,
      max_tokens: options.maxTokens || 4096
    });

    const content = response.content[0];
    const textContent = content.type === 'text' ? content.text : '';

    return {
      id: response.id,
      model: response.model,
      content: textContent,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    };
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<StreamingChunk> {
    const systemMessage = options.messages.find(m => m.role === 'system');
    const conversationMessages = options.messages.filter(m => m.role !== 'system');

    const stream = await this.client.messages.stream({
      model: options.model,
      system: systemMessage?.content,
      messages: conversationMessages as Anthropic.MessageParam[],
      temperature: options.temperature,
      max_tokens: options.maxTokens || 4096
    });

    let id = '';
    for await (const chunk of stream) {
      if (chunk.type === 'message_start') {
        id = chunk.message.id;
      }
      if (chunk.type === 'content_block_delta') {
        const delta = chunk.delta.type === 'text_delta' ? chunk.delta.text : '';
        yield { id, delta, done: false };
      }
      if (chunk.type === 'message_stop') {
        yield { id, delta: '', done: true };
      }
    }
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-opus-4-5-20250109',
      'claude-sonnet-4-5-20250501',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }
}
