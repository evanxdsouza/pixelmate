export type DangerLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface SecurityRule {
  toolName: string;
  dangerLevel: DangerLevel;
  description: string;
  requiresConfirmation: boolean;
}

export const DANGEROUS_TOOLS: SecurityRule[] = [
  // Critical - Always require confirmation
  {
    toolName: 'delete_file',
    dangerLevel: 'critical',
    description: 'Delete files or directories',
    requiresConfirmation: true
  },
  {
    toolName: 'move_file',
    dangerLevel: 'critical',
    description: 'Move or rename files',
    requiresConfirmation: true
  },
  // High - Require confirmation
  {
    toolName: 'browser_navigate',
    dangerLevel: 'high',
    description: 'Navigate to a URL',
    requiresConfirmation: true,
  },
  // Medium - May require confirmation based on context
  {
    toolName: 'write_file',
    dangerLevel: 'medium',
    description: 'Write content to a file',
    requiresConfirmation: true
  },
  {
    toolName: 'browser_fill',
    dangerLevel: 'medium',
    description: 'Fill form inputs',
    requiresConfirmation: true
  },
  {
    toolName: 'browser_click',
    dangerLevel: 'medium',
    description: 'Click elements in the page',
    requiresConfirmation: true
  },
  {
    toolName: 'create_spreadsheet',
    dangerLevel: 'medium',
    description: 'Create a spreadsheet file',
    requiresConfirmation: true
  },
  {
    toolName: 'create_document',
    dangerLevel: 'medium',
    description: 'Create a Word document',
    requiresConfirmation: true
  },
  {
    toolName: 'create_presentation',
    dangerLevel: 'medium',
    description: 'Create a PowerPoint presentation',
    requiresConfirmation: true
  },
  {
    toolName: 'create_csv',
    dangerLevel: 'medium',
    description: 'Create a CSV file',
    requiresConfirmation: true
  },
  {
    toolName: 'web_search',
    dangerLevel: 'low',
    description: 'Search the web for information',
    requiresConfirmation: false
  },
  {
    toolName: 'fetch_web_page',
    dangerLevel: 'low',
    description: 'Fetch content from a web page',
    requiresConfirmation: false
  }
];

export function getDangerLevel(toolName: string): DangerLevel {
  const rule = DANGEROUS_TOOLS.find(r => r.toolName === toolName);
  return rule?.dangerLevel || 'none';
}

export function requiresConfirmation(toolName: string): boolean {
  const rule = DANGEROUS_TOOLS.find(r => r.toolName === toolName);
  return rule?.requiresConfirmation || false;
}

export function getSecurityWarning(toolName: string): string | null {
  const rule = DANGEROUS_TOOLS.find(r => r.toolName === toolName);
  if (!rule || !rule.requiresConfirmation) return null;
  
  return `⚠️ ${rule.description} - This action requires confirmation before proceeding.`;
}
