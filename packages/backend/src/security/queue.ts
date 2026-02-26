import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

export interface PendingConfirmation {
  id: string;
  toolName: string;
  parameters: Record<string, unknown>;
  dangerLevel: string;
  description: string;
  taskId: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
}

export interface ConfirmationRequest {
  toolName: string;
  parameters: Record<string, unknown>;
  dangerLevel: string;
  description: string;
  taskId: string;
}

class ConfirmationQueue {
  private pending: Map<string, PendingConfirmation> = new Map();
  private clients: Set<WebSocket> = new Set();
  private timeout = 60000; // 1 minute timeout

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
  }

  removeClient(ws: WebSocket): void {
    this.clients.delete(ws);
  }

  async requestConfirmation(request: ConfirmationRequest): Promise<boolean> {
    const confirmation: PendingConfirmation = {
      id: uuidv4(),
      toolName: request.toolName,
      parameters: request.parameters,
      dangerLevel: request.dangerLevel,
      description: request.description,
      taskId: request.taskId,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    this.pending.set(confirmation.id, confirmation);

    // Notify all connected clients
    this.broadcast({
      type: 'confirmation_request',
      confirmation: {
        id: confirmation.id,
        toolName: confirmation.toolName,
        dangerLevel: confirmation.dangerLevel,
        description: confirmation.description,
        parameters: this.sanitizeParameters(confirmation.parameters),
        taskId: confirmation.taskId,
        timestamp: confirmation.timestamp
      }
    });

    // Wait for confirmation or timeout
    return new Promise((resolve) => {
      const checkStatus = () => {
        const conf = this.pending.get(confirmation.id);
        if (!conf) {
          resolve(false);
          return;
        }

        if (conf.status === 'approved') {
          this.pending.delete(confirmation.id);
          resolve(true);
        } else if (conf.status === 'denied' || conf.status === 'expired') {
          this.pending.delete(confirmation.id);
          resolve(false);
        } else {
          setTimeout(checkStatus, 500);
        }
      };

      setTimeout(() => {
        const conf = this.pending.get(confirmation.id);
        if (conf && conf.status === 'pending') {
          conf.status = 'expired';
          this.broadcast({
            type: 'confirmation_expired',
            id: confirmation.id
          });
        }
        resolve(false);
      }, this.timeout);
    });
  }

  approve(confirmationId: string): boolean {
    const confirmation = this.pending.get(confirmationId);
    if (!confirmation || confirmation.status !== 'pending') {
      return false;
    }
    confirmation.status = 'approved';
    this.broadcast({
      type: 'confirmation_approved',
      id: confirmationId
    });
    return true;
  }

  deny(confirmationId: string): boolean {
    const confirmation = this.pending.get(confirmationId);
    if (!confirmation || confirmation.status !== 'pending') {
      return false;
    }
    confirmation.status = 'denied';
    this.broadcast({
      type: 'confirmation_denied',
      id: confirmationId
    });
    return true;
  }

  getPending(): PendingConfirmation[] {
    return Array.from(this.pending.values()).filter(c => c.status === 'pending');
  }

  private sanitizeParameters(params: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private broadcast(message: object): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}

export const confirmationQueue = new ConfirmationQueue();
