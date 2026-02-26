import OpenAI from 'openai';
import { LLMProvider, ChatOptions, ChatResponse, StreamingChunk } from './types.js';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY
    });
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: options.temperature,
      max_tokens: options.maxTokens
    });

    const choice = response.choices[0];
    return {
      id: response.id,
      model: response.model,
      content: choice.message.content || '',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0
      }
    };
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<StreamingChunk> {
    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      yield {
        id: chunk.id,
        delta,
        done: chunk.choices[0]?.finish_reason === 'stop'
      };
    }
  }

  async listModels(): Promise<string[]> {
    const models = await this.client.models.list();
    return models.data
      .filter(m => m.id.startsWith('gpt'))
      .map(m => m.id);
  }
}
