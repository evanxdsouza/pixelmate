import { Message, ToolCall, ToolResult, LLMProvider } from '@pixelmate/shared';
import { ToolRegistry } from '../tools/registry.js';

export type AgentState = 'idle' | 'thinking' | 'acting' | 'done' | 'error';

export interface AgentOptions {
  systemPrompt?: string;
  maxTurns?: number;
  workingDirectory?: string;
  model?: string;
  provider?: LLMProvider;
  confirmationHandler?: (toolName: string, params: Record<string, unknown>) => Promise<boolean>;
}

export interface AgentEvent {
  type: 'state_change' | 'thought' | 'tool_call' | 'tool_result' | 'message' | 'error';
  state?: AgentState;
  thought?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  message?: string;
  error?: string;
}

export type AgentEventHandler = (event: AgentEvent) => void;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const DEFAULT_MAX_TURNS = 50;
const DEFAULT_SYSTEM_PROMPT = `You are PixelMate, an AI agent that can help users accomplish tasks.
You have access to various tools to interact with files, browsers, and other systems.
Always explain your reasoning and ask for clarification when needed.`;

export class Agent {
  private provider: LLMProvider;
  private tools: ToolRegistry;
  private messages: Message[] = [];
  private systemPrompt: string;
  private maxTurns: number;
  private workingDirectory: string;
  private state: AgentState = 'idle';
  private currentTurn = 0;
  private eventHandlers: Set<AgentEventHandler> = new Set();
  private taskId: string;
  private confirmationHandler?: (toolName: string, params: Record<string, unknown>) => Promise<boolean>;

  constructor(provider: LLMProvider, tools: ToolRegistry, options: AgentOptions = {}) {
    this.provider = provider;
    this.tools = tools;
    this.systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    this.maxTurns = options.maxTurns || DEFAULT_MAX_TURNS;
    this.workingDirectory = options.workingDirectory || '/workspace';
    this.taskId = generateId();
    this.confirmationHandler = options.confirmationHandler;
  }

  getId(): string {
    return this.taskId;
  }

  getState(): AgentState {
    return this.state;
  }

  getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  onEvent(handler: AgentEventHandler): void {
    this.eventHandlers.add(handler);
  }

  offEvent(handler: AgentEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  private emit(event: AgentEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error('Event handler error:', err);
      }
    });
  }

  private setState(state: AgentState): void {
    this.state = state;
    this.emit({ type: 'state_change', state });
  }

  async run(prompt: string, model?: string): Promise<string> {
    this.taskId = generateId();
    this.currentTurn = 0;
    this.messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: prompt }
    ];
    
    this.setState('thinking');
    this.emit({ type: 'message', message: prompt });
    
    try {
      const result = await this.runAgentLoop(model);
      this.setState('done');
      return result;
    } catch (error) {
      this.setState('error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit({ type: 'error', error: errorMessage });
      throw error;
    }
  }

  private async runAgentLoop(model?: string): Promise<string> {
    let finalResponse = '';
    
    while (this.currentTurn < this.maxTurns) {
      this.currentTurn++;
      
      const response = await this.provider.chat({
        messages: this.messages,
        model: model || 'claude-sonnet-4'
      });
      
      const content = response.content;
      this.messages.push({ role: 'assistant', content });
      
      this.emit({ type: 'thought', thought: content });
      
      // Check if the model wants to use tools
      const toolCalls = this.extractToolCalls(content);
      
      if (toolCalls.length === 0) {
        // No tool calls, this is the final response
        finalResponse = content;
        break;
      }
      
      // Execute each tool call
      for (const toolCall of toolCalls) {
        this.setState('acting');
        this.emit({ type: 'tool_call', toolCall });
        
        // Check if confirmation is required (if handler is provided)
        if (this.confirmationHandler) {
          const needsConfirmation = this.requiresToolConfirmation(toolCall.name);
          if (needsConfirmation) {
            this.emit({ type: 'message', message: `⏳ Waiting for confirmation to execute ${toolCall.name}...` });
            const approved = await this.confirmationHandler(toolCall.name, toolCall.parameters);
            if (!approved) {
              const deniedResult: ToolResult = { success: false, error: 'Confirmation denied by user' };
              this.emit({ type: 'tool_result', toolResult: deniedResult });
              this.messages.push({ 
                role: 'user', 
                content: `Tool ${toolCall.name} was denied by user` 
              });
              continue;
            }
          }
        }
        
        const result = await this.tools.execute(toolCall);
        this.emit({ type: 'tool_result', toolResult: result });
        
        const resultMessage = result.success 
          ? `Tool ${toolCall.name} result: ${result.output}`
          : `Tool ${toolCall.name} error: ${result.error}`;
        
        this.messages.push({ 
          role: 'user', 
          content: resultMessage 
        });
        
        this.setState('thinking');
      }
    }
    
    return finalResponse;
  }

  private extractToolCalls(content: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const toolDefinitions = this.tools.getDefinitions();
    const toolNames = toolDefinitions.map(t => t.name);
    
    // Simple extraction - look for tool call patterns
    // Format: [TOOL_CALL]tool_name: {param: value}[/TOOL_CALL]
    const callRegex = /\[TOOL_CALL\]([\w]+):\s*(\{[^}]+\})\[\/TOOL_CALL\]/g;
    
    let match;
    while ((match = callRegex.exec(content)) !== null) {
      const toolName = match[1];
      if (toolNames.includes(toolName)) {
        try {
          const params = JSON.parse(match[2]);
          toolCalls.push({
            name: toolName,
            id: generateId(),
            parameters: params
          });
        } catch {
          // Invalid JSON, skip
        }
      }
    }
    
    // Also check for markdown code blocks with tool calls
    const codeBlockRegex = /```json\n([\s\S]*?)\n```/g;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.name && toolNames.includes(item.name)) {
              toolCalls.push({
                name: item.name,
                id: generateId(),
                parameters: item.parameters || {}
              });
            }
          }
        }
      } catch {
        // Not valid JSON, skip
      }
    }
    
    return toolCalls;
  }

  private requiresToolConfirmation(toolName: string): boolean {
    // Tools that require confirmation before execution
    const dangerousTools = [
      'delete_file',
      'move_file',
      'write_file',
      'create_directory',
      'browser_click',
      'browser_type',
      'browser_fill'
    ];
    return dangerousTools.includes(toolName);
  }

  cancel(): void {
    this.setState('done');
  }

  getMessages(): Message[] {
    return [...this.messages];
  }
}
