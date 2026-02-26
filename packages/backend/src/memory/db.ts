import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  status: 'active' | 'completed' | 'cancelled';
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface Preference {
  key: string;
  value: string;
}

export class MemoryDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        title TEXT,
        status TEXT DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(sessionId);
    `);
  }

  // Session methods
  createSession(title?: string): Session {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    this.db.prepare(`
      INSERT INTO sessions (id, createdAt, updatedAt, title, status)
      VALUES (?, ?, ?, ?, 'active')
    `).run(id, now, now, title || 'New Session');
    
    return { id, createdAt: now, updatedAt: now, title: title || 'New Session', status: 'active' };
  }

  getSession(id: string): Session | undefined {
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
  }

  getActiveSession(): Session | undefined {
    return this.db.prepare("SELECT * FROM sessions WHERE status = 'active' ORDER BY updatedAt DESC LIMIT 1").get() as Session | undefined;
  }

  listSessions(limit = 10): Session[] {
    return this.db.prepare('SELECT * FROM sessions ORDER BY updatedAt DESC LIMIT ?').all(limit) as Session[];
  }

  updateSession(id: string, updates: Partial<Session>): void {
    const now = new Date().toISOString();
    const session = this.getSession(id);
    if (!session) return;

    this.db.prepare(`
      UPDATE sessions SET title = ?, status = ?, updatedAt = ? WHERE id = ?
    `).run(
      updates.title || session.title,
      updates.status || session.status,
      now,
      id
    );
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM messages WHERE sessionId = ?').run(id);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  // Message methods
  addMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string): Message {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    this.db.prepare(`
      INSERT INTO messages (id, sessionId, role, content, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, sessionId, role, content, now);

    // Update session timestamp
    this.db.prepare('UPDATE sessions SET updatedAt = ? WHERE id = ?').run(now, sessionId);

    return { id, sessionId, role, content, createdAt: now };
  }

  getMessages(sessionId: string): Message[] {
    return this.db.prepare('SELECT * FROM messages WHERE sessionId = ? ORDER BY createdAt ASC').all(sessionId) as Message[];
  }

  // Preference methods
  setPreference(key: string, value: string): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)
    `).run(key, value);
  }

  getPreference(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM preferences WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  getAllPreferences(): Preference[] {
    return this.db.prepare('SELECT * FROM preferences').all() as Preference[];
  }

  close(): void {
    this.db.close();
  }
}
