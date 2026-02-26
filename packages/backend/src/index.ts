import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { LLMClient } from './providers/index.js';
import { Agent, ToolRegistry } from './agents/index.js';
import { config } from './config/index.js';
import { ReadFileTool, WriteFileTool, ListDirectoryTool, CreateDirectoryTool, DeleteFileTool, MoveFileTool, CopyFileTool, GlobTool } from './tools/filesystem/index.js';
import { NavigateTool, ClickTool, FillTool, TypeTool, SelectTool, GetTextTool, GetHtmlTool, ScreenshotTool, SnapshotTool, ScrollTool, WaitForSelectorTool, ClosePageTool } from './tools/browser/index.js';
import { SkillLoader } from './skills/index.js';
import { MemoryDB } from './memory/index.js';
import { requiresConfirmation, getDangerLevel, confirmationQueue, getSecurityWarning } from './security/index.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
    return res.status(200).json({});
  }
  next();
});

// Initialize tools
const workingDir = config.getWorkingDir();
const toolRegistry = new ToolRegistry();

// File system tools
toolRegistry.register(new ReadFileTool(workingDir));
toolRegistry.register(new WriteFileTool(workingDir));
toolRegistry.register(new ListDirectoryTool(workingDir));
toolRegistry.register(new CreateDirectoryTool(workingDir));
toolRegistry.register(new DeleteFileTool(workingDir));
toolRegistry.register(new MoveFileTool(workingDir));
toolRegistry.register(new CopyFileTool(workingDir));
toolRegistry.register(new GlobTool(workingDir));

// Browser tools
toolRegistry.register(new NavigateTool());
toolRegistry.register(new ClickTool());
toolRegistry.register(new FillTool());
toolRegistry.register(new TypeTool());
toolRegistry.register(new SelectTool());
toolRegistry.register(new GetTextTool());
toolRegistry.register(new GetHtmlTool());
toolRegistry.register(new ScreenshotTool());
toolRegistry.register(new SnapshotTool());
toolRegistry.register(new ScrollTool());
toolRegistry.register(new WaitForSelectorTool());
toolRegistry.register(new ClosePageTool());

// Initialize skills
const skillsDir = './src/skills/builtin';
const skillLoader = new SkillLoader(skillsDir);
await skillLoader.loadAll();
console.log(`Loaded ${skillLoader.list().length} skills`);

// Initialize memory database
const memoryDb = new MemoryDB('./pixelmate.db');
console.log('Memory database initialized');

// Store active agents
const activeAgents = new Map<string, Agent>();

// API Routes

// Start a new agent task
app.post('/api/agent/start', async (req, res) => {
  try {
    const { prompt, model, provider } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const taskId = uuidv4();
    const llm = new LLMClient(provider || config.getDefaultProvider());
    const agent = new Agent(llm, toolRegistry, {
      model,
      workingDirectory: workingDir,
      confirmationHandler: async (toolName: string, params: Record<string, unknown>) => {
        const dangerLevel = getDangerLevel(toolName);
        const approved = await confirmationQueue.requestConfirmation({
          toolName,
          parameters: params,
          dangerLevel,
          description: getSecurityWarning(toolName) || `Execute ${toolName}`,
          taskId
        });
        return approved;
      }
    });

    activeAgents.set(taskId, agent);

    // Start agent in background
    agent.run(prompt)
      .then(result => {
        console.log(`Task ${taskId} completed:`, result.slice(0, 100));
      })
      .catch(error => {
        console.error(`Task ${taskId} error:`, error);
      });

    res.json({ taskId, status: 'started' });
  } catch (error) {
    console.error('Error starting agent:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get task status
app.get('/api/agent/status/:taskId', (req, res) => {
  const { taskId } = req.params;
  const agent = activeAgents.get(taskId);
  
  if (!agent) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({
    taskId,
    state: agent.getState(),
    workingDirectory: agent.getWorkingDirectory()
  });
});

// Cancel a task
app.post('/api/agent/cancel/:taskId', (req, res) => {
  const { taskId } = req.params;
  const agent = activeAgents.get(taskId);
  
  if (!agent) {
    return res.status(404).json({ error: 'Task not found' });
  }

  agent.cancel();
  activeAgents.delete(taskId);
  
  res.json({ taskId, status: 'cancelled' });
});

// Get available tools
app.get('/api/tools', (req, res) => {
  const tools = toolRegistry.getDefinitions();
  res.json({ tools });
});

// Get available skills
app.get('/api/skills', (req, res) => {
  const skills = skillLoader.list();
  res.json({ skills });
});

// File operations
app.get('/api/files', (req, res) => {
  const { path } = req.query;
  const tool = new ListDirectoryTool(workingDir);
  
  tool.execute({ path: path || '.' })
    .then(result => {
      if (result.success) {
        res.json({ files: JSON.parse(result.output!) });
      } else {
        res.status(500).json({ error: result.error });
      }
    });
});

app.post('/api/files/read', (req, res) => {
  const { path } = req.body;
  const tool = new ReadFileTool(workingDir);
  
  tool.execute({ path })
    .then(result => {
      if (result.success) {
        res.json({ content: result.output });
      } else {
        res.status(500).json({ error: result.error });
      }
    });
});

app.post('/api/files/write', (req, res) => {
  const { path, content } = req.body;
  const tool = new WriteFileTool(workingDir);
  
  tool.execute({ path, content })
    .then(result => {
      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: result.error });
      }
    });
});

// Get configuration info
app.get('/api/config', (req, res) => {
  res.json({
    workingDirectory: workingDir,
    maxTurns: config.getMaxTurns(),
    defaultProvider: config.getDefaultProvider()
  });
});

// Memory/Session API Routes

// Create new session
app.post('/api/sessions', (req, res) => {
  const { title } = req.body;
  const session = memoryDb.createSession(title);
  res.json({ session });
});

// List sessions
app.get('/api/sessions', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const sessions = memoryDb.listSessions(limit);
  res.json({ sessions });
});

// Get session
app.get('/api/sessions/:id', (req, res) => {
  const session = memoryDb.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const messages = memoryDb.getMessages(session.id);
  res.json({ session, messages });
});

// Get messages for session
app.get('/api/sessions/:id/messages', (req, res) => {
  const messages = memoryDb.getMessages(req.params.id);
  res.json({ messages });
});

// Add message to session
app.post('/api/sessions/:id/messages', (req, res) => {
  const { role, content } = req.body;
  const message = memoryDb.addMessage(req.params.id, role, content);
  res.json({ message });
});

// Preferences
app.get('/api/preferences', (req, res) => {
  const prefs = memoryDb.getAllPreferences();
  res.json({ preferences: prefs });
});

app.get('/api/preferences/:key', (req, res) => {
  const value = memoryDb.getPreference(req.params.key);
  if (value === undefined) {
    return res.status(404).json({ error: 'Preference not found' });
  }
  res.json({ key: req.params.key, value });
});

app.post('/api/preferences', (req, res) => {
  const { key, value } = req.body;
  memoryDb.setPreference(key, value);
  res.json({ success: true });
});

// Confirmation API Routes

// Get pending confirmations
app.get('/api/confirmations', (req, res) => {
  const pending = confirmationQueue.getPending();
  res.json({ confirmations: pending });
});

// Approve a confirmation
app.post('/api/confirmations/:id/approve', (req, res) => {
  const { id } = req.params;
  const success = confirmationQueue.approve(id);
  if (success) {
    res.json({ success: true, message: 'Confirmation approved' });
  } else {
    res.status(404).json({ success: false, error: 'Confirmation not found or already processed' });
  }
});

// Deny a confirmation
app.post('/api/confirmations/:id/deny', (req, res) => {
  const { id } = req.params;
  const success = confirmationQueue.deny(id);
  if (success) {
    res.json({ success: true, message: 'Confirmation denied' });
  } else {
    res.status(404).json({ success: false, error: 'Confirmation not found or already processed' });
  }
});

// Create HTTP server
const server = createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected via WebSocket');
  
  // Register client for confirmation notifications
  confirmationQueue.addClient(ws);

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'start_task') {
        const { prompt, model, provider } = data;
        const taskId = uuidv4();
        
        const llm = new LLMClient(provider || config.getDefaultProvider());
        const agent = new Agent(llm, toolRegistry, {
          model,
          workingDirectory: workingDir,
          confirmationHandler: async (toolName: string, params: Record<string, unknown>) => {
            const dangerLevel = getDangerLevel(toolName);
            const approved = await confirmationQueue.requestConfirmation({
              toolName,
              parameters: params,
              dangerLevel,
              description: getSecurityWarning(toolName) || `Execute ${toolName}`,
              taskId
            });
            return approved;
          }
        });
        
        activeAgents.set(taskId, agent);
        
        // Send task started
        ws.send(JSON.stringify({ type: 'task_started', taskId }));
        
        // Forward agent events to client
        agent.onEvent((event) => {
          ws.send(JSON.stringify({ type: 'agent_event', taskId, event }));
        });
        
        // Run agent
        agent.run(prompt)
          .then(result => {
            ws.send(JSON.stringify({ type: 'task_completed', taskId, result }));
            activeAgents.delete(taskId);
          })
          .catch(error => {
            ws.send(JSON.stringify({ type: 'task_error', taskId, error: error.message }));
            activeAgents.delete(taskId);
          });
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    confirmationQueue.removeClient(ws);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    PixelMate Server                        ║
║                                                           ║
║  HTTP Server:  http://localhost:${PORT}                     ║
║  WebSocket:    ws://localhost:${PORT}/ws                   ║
║                                                           ║
║  Available tools: ${toolRegistry.getAll().length}                                ║
║  Working dir:  ${workingDir}                 ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export { app, server, wss };
