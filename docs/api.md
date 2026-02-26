# API Reference

Complete API documentation for PixelMate backend services.

---

## Base URL

```
http://localhost:3001
```

---

## Health Check

### GET /health

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-26T12:00:00.000Z"
}
```

---

## Agent API

### POST /api/agent/start

Start a new agent task.

**Request:**
```json
{
  "prompt": "Your task description",
  "model": "gpt-4",           // Optional
  "provider": "openai"        // Optional
}
```

**Response:**
```json
{
  "taskId": "uuid-string",
  "status": "started"
}
```

---

### GET /api/agent/status/:taskId

Get task status.

**Response:**
```json
{
  "taskId": "uuid-string",
  "state": "thinking",
  "workingDirectory": "/path/to/workspace"
}
```

**States:**
- `idle` - Not started
- `thinking` - Processing
- `acting` - Executing tools
- `done` - Completed
- `error` - Failed

---

### POST /api/agent/cancel/:taskId

Cancel a running task.

**Response:**
```json
{
  "taskId": "uuid-string",
  "status": "cancelled"
}
```

---

## Tools API

### GET /api/tools

Get list of available tools.

**Response:**
```json
{
  "tools": [
    {
      "name": "read_file",
      "description": "Read file contents",
      "parameters": [
        {
          "name": "path",
          "description": "File path",
          "type": "string",
          "required": true
        }
      ]
    }
  ]
}
```

---

## Files API

### GET /api/files

List files in a directory.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | string | Directory path (default: ".") |

**Response:**
```json
{
  "files": [
    {
      "name": "document.txt",
      "type": "file",
      "size": 1024,
      "modified": "2026-02-26T12:00:00.000Z"
    }
  ]
}
```

---

### POST /api/files/read

Read a file.

**Request:**
```json
{
  "path": "document.txt"
}
```

**Response:**
```json
{
  "content": "File contents here..."
}
```

---

### POST /api/files/write

Write to a file.

**Request:**
```json
{
  "path": "output.txt",
  "content": "File content"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Sessions API

### POST /api/sessions

Create a new session.

**Request:**
```json
{
  "title": "My Session"
}
```

**Response:**
```json
{
  "session": {
    "id": "session-uuid",
    "title": "My Session",
    "createdAt": "2026-02-26T12:00:00.000Z"
  }
}
```

---

### GET /api/sessions

List sessions.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 10 | Number of sessions |

**Response:**
```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "title": "Session 1",
      "createdAt": "2026-02-26T12:00:00.000Z"
    }
  ]
}
```

---

### GET /api/sessions/:id

Get session with messages.

**Response:**
```json
{
  "session": { ... },
  "messages": [
    {
      "id": "msg-uuid",
      "role": "user",
      "content": "Hello",
      "timestamp": "2026-02-26T12:00:00.000Z"
    }
  ]
}
```

---

### GET /api/sessions/:id/messages

Get session messages.

**Response:**
```json
{
  "messages": [...]
}
```

---

### POST /api/sessions/:id/messages

Add message to session.

**Request:**
```json
{
  "role": "user",
  "content": "My message"
}
```

**Response:**
```json
{
  "message": {
    "id": "msg-uuid",
    "role": "user",
    "content": "My message",
    "timestamp": "2026-02-26T12:00:00.000Z"
  }
}
```

---

## Preferences API

### GET /api/preferences

Get all preferences.

**Response:**
```json
{
  "preferences": {
    "theme": "dark",
    "model": "gpt-4"
  }
}
```

---

### GET /api/preferences/:key

Get a specific preference.

**Response:**
```json
{
  "key": "theme",
  "value": "dark"
}
```

---

### POST /api/preferences

Set a preference.

**Request:**
```json
{
  "key": "theme",
  "value": "dark"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Skills API

### GET /api/skills

Get available skills.

**Response:**
```json
{
  "skills": [
    {
      "name": "Research",
      "description": "Conduct web research...",
      "examples": ["Find info about X"],
      "parameters": [...]
    }
  ]
}
```

---

## Configuration API

### GET /api/config

Get configuration info.

**Response:**
```json
{
  "workingDirectory": "./workspace",
  "maxTurns": 10,
  "defaultProvider": "openai"
}
```

---

## Confirmation API

### GET /api/confirmations

Get pending confirmations.

**Response:**
```json
{
  "confirmations": [
    {
      "id": "conf-uuid",
      "toolName": "write_file",
      "parameters": { ... },
      "dangerLevel": "medium",
      "description": "Write content to file",
      "taskId": "task-uuid",
      "requestedAt": "2026-02-26T12:00:00.000Z"
    }
  ]
}
```

---

### POST /api/confirmations/:id/approve

Approve a confirmation.

**Response:**
```json
{
  "success": true,
  "message": "Confirmation approved"
}
```

---

### POST /api/confirmations/:id/deny

Deny a confirmation.

**Response:**
```json
{
  "success": true,
  "message": "Confirmation denied"
}
```

---

## WebSocket API

### Connection

```
ws://localhost:3001/ws
```

### Message Types

#### Client → Server

**start_task**
```json
{
  "type": "start_task",
  "prompt": "Your task",
  "model": "gpt-4",
  "provider": "openai"
}
```

**confirmation_response**
```json
{
  "type": "confirmation_response",
  "confirmationId": "conf-uuid",
  "approved": true
}
```

#### Server → Client

**task_started**
```json
{
  "type": "task_started",
  "taskId": "uuid"
}
```

**agent_event**
```json
{
  "type": "agent_event",
  "taskId": "uuid",
  "event": {
    "type": "thought",
    "thought": "I'll help you with that..."
  }
}
```

**Agent Event Types:**
- `state_change` - Agent state changed
- `thought` - Agent reasoning
- `tool_call` - Tool being executed
- `tool_result` - Tool execution result
- `message` - Message to user
- `error` - Error occurred

**task_completed**
```json
{
  "type": "task_completed",
  "taskId": "uuid",
  "result": "Final response..."
}
```

**task_error**
```json
{
  "type": "task_error",
  "taskId": "uuid",
  "error": "Error message"
}
```

**confirmation_request**
```json
{
  "type": "confirmation_request",
  "confirmation": {
    "id": "conf-uuid",
    "toolName": "write_file",
    "dangerLevel": "medium",
    "description": "Write content to file"
  }
}
```

---

## Error Responses

All endpoints may return error responses:

```json
{
  "error": "Error message"
}
```

**Common HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 400 | Bad Request |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Rate Limits

Currently no rate limits enforced. For production, consider adding:
- Request throttling
- Concurrent task limits
- API key authentication

---

## Next Steps

- [Architecture](./architecture.md) - System design
- [Tools Reference](./tools.md) - Available tools
- [Configuration](./configuration.md) - Settings
