/**
 * Message types for communication between extension components and PWA
 */

export interface ExtensionMessage {
  type: string;
  data?: unknown;
  id?: string;
}

export interface AgentExecuteRequest {
  type: 'AGENT_EXECUTE';
  prompt: string;
  model?: string;
  provider?: string;
}

export interface AgentEventMessage {
  type: 'AGENT_EVENT';
  event: {
    type: 'state_change' | 'thought' | 'tool_call' | 'tool_result' | 'message' | 'error';
    state?: string;
    thought?: string;
    toolCall?: any;
    toolResult?: any;
    message?: string;
    error?: string;
  };
}

export interface ConfirmationRequest {
  type: 'CONFIRMATION_REQUEST';
  toolName: string;
  params: Record<string, unknown>;
  requestId: string;
  timeout: number;
}

export interface ConfigGetRequest {
  type: 'CONFIG_GET';
  keys: string[];
}

export interface ConfigGetResponse {
  type: 'CONFIG_GET_RESPONSE';
  values: Record<string, unknown>;
}
