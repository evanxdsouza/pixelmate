import { v4 as uuidv4 } from 'uuid';
import { LLMClient, Message } from '../providers/index.js';
import { ToolRegistry } from '../tools/registry.js';
import { Tool, ToolCall, ToolResult } from '../tools/types.js';
import { config } from '../config/index.js';
import { requiresConfirmation } from '../security/config.js';

function requiresToolConfirmation(toolName: string): boolean {
  return requiresConfirmation(toolName);
}

export type AgentState = 'idle' | 'thinking' | 'acting' | 'done' | 'error';

export interface AgentOptions {
  systemPrompt?: string;
  maxTurns?: number;
  workingDirectory?: string;
  model?: string;
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

export class Agent {
  private llm: LLMClient;
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

  constructor(llm: LLMClient, tools: ToolRegistry, options: AgentOptions = {}) {
    this.llm = llm;
    this.tools = tools;
    this.systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
    this.maxTurns = options.maxTurns || config.getMaxTurns();
    this.workingDirectory = options.workingDirectory || config.getWorkingDir();
    this.taskId = uuidv4();
    this.confirmationHandler = options.confirmationHandler;
  }

  private getDefaultSystemPrompt(): string {
    return `You are PixelMate, an AI agent that can help users accomplish tasks.
You have access to various tools to interact with files, browsers, and other systems.
Always explain your reasoning and ask for clarification when needed.`;
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

  async run(prompt: string): Promise<string> {
    this.taskId = uuidv4();
    this.currentTurn = 0;
    this.messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: prompt }
    ];
    
    this.setState('thinking');
    this.emit({ type: 'message', message: prompt });
    
    try {
      const result = await this.runAgentLoop();
      this.setState('done');
      return result;
    } catch (error) {
      this.setState('error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit({ type: 'error', error: errorMessage });
      throw error;
    }
  }

  private async runAgentLoop(): Promise<string> {
    let finalResponse = '';
    
    while (this.currentTurn < this.maxTurns) {
      this.currentTurn++;
      
      const response = await this.llm.chat({
        messages: this.messages,
        model: this.taskId // This will use default model
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
        
        // Check if confirmation is required
        if (this.confirmationHandler) {
          const needsConfirmation = requiresToolConfirmation(toolCall.name);
          if (needsConfirmation) {
            this.emit({ type: 'message', message: `⏳ Waiting for confirmation to execute ${toolCall.name}...` });
            const approved = await this.confirmationHandler(toolCall.name, toolCall.parameters);
            if (!approved) {
              const deniedResult = { success: false, error: 'Confirmation denied by user' };
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
            id: uuidv4(),
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
                id: uuidv4(),
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

  cancel(): void {
    this.setState('done');
  }

  getMessages(): Message[] {
    return [...this.messages];
  }
}
