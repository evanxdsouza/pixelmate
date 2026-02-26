# Security Guide

Understanding PixelMate's security model and best practices.

---

## Overview

PixelMate implements a multi-layered security approach:
- **Sandboxing** - File operations restricted to working directory
- **Confirmation System** - Dangerous actions require user approval
- **Danger Levels** - Categorized risk assessment for tools

---

## Danger Levels

| Level | Description | Examples | Confirmation |
|-------|-------------|----------|-------------|
| `none` | Safe operations | `read_file`, `list_directory` | No |
| `low` | Minor side effects | `web_search`, `fetch_web_page` | No |
| `medium` | Modifies data | `write_file`, `create_spreadsheet` | Yes |
| `high` | Significant changes | `browser_navigate` | Yes |
| `critical` | Destructive actions | `delete_file`, `move_file` | Yes |

---

## Confirmation System

### How It Works

1. Agent attempts to execute a tool
2. System checks if tool requires confirmation
3. If required, request queued
4. User notified via WebSocket
5. User approves or denies
6. Tool executes or cancelled

### Confirmation Dialog

When a dangerous action is requested, you'll see:

```
⚠️ Confirmation Required

Tool: write_file
Danger Level: Medium
Path: /workspace/report.txt
Content: (preview)

[ Deny ]  [ Approve ]
```

### Via API

```bash
# Get pending confirmations
curl http://localhost:3001/api/confirmations

# Approve
curl -X POST http://localhost:3001/api/confirmations/{id}/approve

# Deny
curl -X POST http://localhost:3001/api/confirmations/{id}/deny
```

---

## File System Security

### Sandbox

All file operations are sandboxed to the working directory.

**Default:** `./workspace`

**Restricted Operations:**
- Cannot access paths outside working directory
- Cannot use path traversal (`../../etc/passwd`)
- Cannot access system files

### Path Resolution

```typescript
class PathSandbox {
  resolve(relativePath: string): string {
    const resolved = path.resolve(this.workingDir, relativePath);
    if (!resolved.startsWith(this.workingDir)) {
      throw new Error('Path outside sandbox');
    }
    return resolved;
  }
}
```

---

## Browser Security

### Headless Mode

Browser runs in headless mode by default, preventing:
- Browser UI manipulation
- Extension conflicts
- Display requirements

### Navigation Restrictions

- Explicit URL required for navigation
- Cannot bypass via JavaScript
- Network requests monitored

### Data Handling

- Screenshot data not persisted
- Page content not cached
- Session data cleared after use

---

## API Security

### Current Status

The API is currently unauthenticated for development. For production:

**Recommended Additions:**
1. API Key authentication
2. Rate limiting
3. CORS restrictions
4. HTTPS enforcement

### Production Checklist

- [ ] Enable authentication
- [ ] Configure rate limits
- [ ] Use HTTPS
- [ ] Restrict CORS
- [ ] Monitor access logs

---

## Security Configuration

### Custom Danger Rules

Edit `packages/backend/src/security/config.ts`:

```typescript
export const DANGEROUS_TOOLS: SecurityRule[] = [
  {
    toolName: 'custom_tool',
    dangerLevel: 'medium',
    description: 'Custom tool description',
    requiresConfirmation: true
  }
];
```

### Danger Levels

```typescript
export type DangerLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
```

---

## Best Practices

### For Users

1. **Review Confirmations** - Always check tool parameters
2. **Use Read-First** - Read files before modifying
3. **Limit Permissions** - Use smallest needed danger level
4. **Monitor Sessions** - Check active sessions regularly

### For Developers

1. **Validate Input** - Sanitize all user inputs
2. **Log Actions** - Maintain audit trail
3. **Minimize Scope** - Restrict tool capabilities
4. **Test Security** - Regular security audits

---

## Known Limitations

- **No Encryption** - Data not encrypted at rest
- **Local Only** - No network-level security
- **Browser Storage** - No encryption for cached data

---

## Reporting Issues

If you discover a security vulnerability:

1. **Don't** create a public GitHub issue
2. **Email** security@pixelmate.ai
3. **Include** detailed reproduction steps
4. **Wait** for acknowledgment before disclosure

---

## Next Steps

- [Configuration](./configuration.md) - Security settings
- [Architecture](./architecture.md) - System design
- [Troubleshooting](./troubleshooting.md) - Common issues
