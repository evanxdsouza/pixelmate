import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from './agent.js';
import { ToolRegistry } from '../tools/registry.js';
import { LLMProvider, ChatOptions, ChatResponse, StreamingChunk, Tool } from '@pixelmate/shared';

// ──────────────────────────────────────────────────────────────
// Mock LLM Provider
// ──────────────────────────────────────────────────────────────

function makeMockProvider(response: string): LLMProvider {
  return {
    name: 'mock',
    async chat(_options: ChatOptions): Promise<ChatResponse> {
      return {
        id: 'mock-id',
        model: 'mock-model',
        content: response,
        usage: { inputTokens: 10, outputTokens: 20 },
      };
    },
    async *chatStream(_options: ChatOptions): AsyncGenerator<StreamingChunk> {
      yield { id: 'mock-id', delta: response, done: false };
      yield { id: 'mock-id', delta: '', done: true };
    },
    async listModels(): Promise<string[]> {
      return ['mock-model'];
    },
  };
}

function makeEmptyRegistry(): ToolRegistry {
  return new ToolRegistry();
}

function makeRegistryWithEchoTool(): ToolRegistry {
  const registry = new ToolRegistry();
  const echoTool: Tool = {
    definition: {
      name: 'echo',
      description: 'Echoes a message',
      parameters: [
        { name: 'message', type: 'string', description: 'msg', required: true },
      ],
    },
    async execute(params: Record<string, unknown>) {
      return { success: true, output: `Echo: ${params.message}` };
    },
  };
  registry.register(echoTool);
  return registry;
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe('Agent', () => {
  describe('initialization', () => {
    it('creates an Agent with an ID', () => {
      const agent = new Agent(makeMockProvider('hi'), makeEmptyRegistry());
      expect(agent.getId()).toBeTruthy();
    });

    it('starts in idle state', () => {
      const agent = new Agent(makeMockProvider('hi'), makeEmptyRegistry());
      expect(agent.getState()).toBe('idle');
    });

    it('accepts a custom systemPrompt', () => {
      const agent = new Agent(makeMockProvider('hi'), makeEmptyRegistry(), {
        systemPrompt: 'You are a test bot.',
      });
      // systemPrompt is private but reflected in first message after run
      expect(agent).toBeDefined();
    });
  });

  describe('run() — simple question/answer', () => {
    it('returns the LLM response when no tool calls are present', async () => {
      const agent = new Agent(makeMockProvider('The answer is 42.'), makeEmptyRegistry());
      const result = await agent.run('What is the answer?');
      expect(result).toBe('The answer is 42.');
    });

    it('transitions state through thinking → done', async () => {
      const states: string[] = [];
      const agent = new Agent(makeMockProvider('Done!'), makeEmptyRegistry());
      agent.onEvent((ev) => {
        if (ev.type === 'state_change' && ev.state) states.push(ev.state);
      });
      await agent.run('Hello');
      expect(states).toContain('thinking');
      expect(states[states.length - 1]).toBe('done');
    });

    it('emits a thought event with the response content', async () => {
      const thoughts: string[] = [];
      const agent = new Agent(makeMockProvider('My thought.'), makeEmptyRegistry());
      agent.onEvent((ev) => {
        if (ev.type === 'thought' && ev.thought) thoughts.push(ev.thought);
      });
      await agent.run('Think!');
      expect(thoughts).toContain('My thought.');
    });

    it('adds both user message and assistant response to getMessages()', async () => {
      const agent = new Agent(makeMockProvider('Pong.'), makeEmptyRegistry());
      await agent.run('Ping');
      const msgs = agent.getMessages();
      const roles = msgs.map(m => m.role);
      expect(roles).toContain('user');
      expect(roles).toContain('assistant');
    });

    it('emits error event and rethrows when provider throws', async () => {
      const brokenProvider: LLMProvider = {
        name: 'broken',
        async chat() { throw new Error('API down'); },
        async *chatStream() { throw new Error('API down'); },
        async listModels() { return []; },
      };
      const errors: string[] = [];
      const agent = new Agent(brokenProvider, makeEmptyRegistry());
      agent.onEvent((ev) => {
        if (ev.type === 'error' && ev.error) errors.push(ev.error);
      });
      await expect(agent.run('fail')).rejects.toThrow('API down');
      expect(errors).toContain('API down');
    });
  });

  describe('run() — tool call extraction (TOOL_CALL format)', () => {
    it('executes a tool call and sends result back to model', async () => {
      // Provider first returns a tool call, then a final answer
      let callCount = 0;
      const provider: LLMProvider = {
        name: 'with-tools',
        async chat(): Promise<ChatResponse> {
          callCount++;
          if (callCount === 1) {
            return {
              id: 'id-1', model: 'mock', content:
                '[TOOL_CALL]echo: {"message":"hello"}[/TOOL_CALL]',
            };
          }
          return { id: 'id-2', model: 'mock', content: 'Final answer.' };
        },
        async *chatStream() { yield { id: '', delta: '', done: true }; },
        async listModels() { return []; },
      };

      const toolCallEvents: string[] = [];
      const agent = new Agent(provider, makeRegistryWithEchoTool());
      agent.onEvent((ev) => {
        if (ev.type === 'tool_call' && ev.toolCall) toolCallEvents.push(ev.toolCall.name);
        if (ev.type === 'tool_result' && ev.toolResult) {
          expect(ev.toolResult.success).toBe(true);
          expect(ev.toolResult.output).toContain('Echo: hello');
        }
      });

      const result = await agent.run('Use echo tool');
      expect(toolCallEvents).toContain('echo');
      expect(result).toBe('Final answer.');
    });

    it('generates a new ID on each run call', async () => {
      const agent = new Agent(makeMockProvider('ok'), makeEmptyRegistry());
      const id1 = agent.getId();
      await agent.run('first');
      const id2 = agent.getId();
      await agent.run('second');
      const id3 = agent.getId();
      // IDs should be different after each run
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
    });
  });

  describe('event handlers', () => {
    it('supports multiple event handlers', async () => {
      const log1: string[] = [];
      const log2: string[] = [];
      const agent = new Agent(makeMockProvider('hi'), makeEmptyRegistry());
      agent.onEvent((ev) => { if (ev.type === 'thought') log1.push('h1'); });
      agent.onEvent((ev) => { if (ev.type === 'thought') log2.push('h2'); });
      await agent.run('test');
      expect(log1).toContain('h1');
      expect(log2).toContain('h2');
    });

    it('offEvent removes a specific handler', async () => {
      const log: string[] = [];
      const handler = (ev: { type: string }) => { if (ev.type === 'thought') log.push('seen'); };
      const agent = new Agent(makeMockProvider('msg'), makeEmptyRegistry());
      agent.onEvent(handler);
      agent.offEvent(handler);
      await agent.run('test');
      expect(log).toHaveLength(0);
    });
  });

  describe('confirmation handler', () => {
    it('calls confirmationHandler for dangerous tools and skips when denied', async () => {
      let callCount = 0;
      const provider: LLMProvider = {
        name: 'danger',
        async chat(): Promise<ChatResponse> {
          callCount++;
          if (callCount === 1) {
            return { id: '1', model: 'mock', content: '[TOOL_CALL]write_file: {"path":"/tmp/x","content":"data"}[/TOOL_CALL]' };
          }
          return { id: '2', model: 'mock', content: 'Skipped.' };
        },
        async *chatStream() { yield { id: '', delta: '', done: true }; },
        async listModels() { return []; },
      };

      const registry = new ToolRegistry();
      registry.register({
        definition: {
          name: 'write_file',
          description: 'Write a file',
          parameters: [
            { name: 'path', type: 'string', description: 'path', required: true },
            { name: 'content', type: 'string', description: 'content', required: true },
          ],
        },
        async execute() { return { success: true, output: 'written' }; },
      });

      const confirmSpy = vi.fn().mockResolvedValue(false); // deny

      const agent = new Agent(provider, registry, { confirmationHandler: confirmSpy });
      await agent.run('Write something');
      expect(confirmSpy).toHaveBeenCalledWith('write_file', expect.any(Object));
    });
  });

  describe('cancel()', () => {
    it('sets state to done when cancel is called', async () => {
      const agent = new Agent(makeMockProvider('ok'), makeEmptyRegistry());
      agent.cancel();
      expect(agent.getState()).toBe('done');
    });
  });
});
