import Dexie, { Table } from 'dexie';

export interface Conversation {
  id?: number;
  conversationId: string;
  title: string;
  model: string;
  provider: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationMessage {
  id?: number;
  conversationId: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Session {
  id?: number;
  sessionId: string;
  apiKeys: Record<string, string>;
  preferences: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface StoredFile {
  id?: number;
  path: string;
  content: Blob | ArrayBuffer | string;
  type: 'file' | 'directory';
  size: number;
  mimeType?: string;
  createdAt: number;
  updatedAt: number;
}

export class PixelMateDB extends Dexie {
  conversations!: Table<Conversation>;
  messages!: Table<ConversationMessage>;
  sessions!: Table<Session>;
  files!: Table<StoredFile>;

  constructor() {
    super('PixelMateDB');
    this.version(1).stores({
      conversations: '++id, conversationId, createdAt',
      messages: '++id, conversationId, timestamp',
      sessions: '++id, sessionId',
      files: '++id, path'
    });
  }
}

export const db = new PixelMateDB();

export async function saveConversation(conversation: Omit<Conversation, 'id'>): Promise<number> {
  return await db.conversations.add(conversation as Conversation);
}

export async function getConversation(conversationId: string): Promise<Conversation | undefined> {
  return await db.conversations.where('conversationId').equals(conversationId).first();
}

export async function getAllConversations(): Promise<Conversation[]> {
  return await db.conversations.orderBy('createdAt').reverse().toArray();
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await db.conversations.where('conversationId').equals(conversationId).delete();
  await db.messages.where('conversationId').equals(conversationId).delete();
}

export async function addMessage(message: Omit<ConversationMessage, 'id'>): Promise<number> {
  return await db.messages.add(message as ConversationMessage);
}

export async function getMessages(conversationId: string): Promise<ConversationMessage[]> {
  return await db.messages
    .where('conversationId')
    .equals(conversationId)
    .orderBy('timestamp')
    .toArray();
}

export async function getSession(sessionId: string): Promise<Session | undefined> {
  return await db.sessions.where('sessionId').equals(sessionId).first();
}

export async function saveSession(session: Omit<Session, 'id'>): Promise<number> {
  const existing = await getSession(session.sessionId);
  if (existing) {
    await db.sessions.update(existing.id!, session);
    return existing.id!;
  }
  return await db.sessions.add(session as Session);
}

export async function saveFile(file: Omit<StoredFile, 'id'>): Promise<number> {
  return await db.files.add(file as StoredFile);
}

export async function getFile(path: string): Promise<StoredFile | undefined> {
  return await db.files.where('path').equals(path).first();
}

export async function deleteFile(path: string): Promise<void> {
  await db.files.where('path').equals(path).delete();
}

export async function listFiles(directory: string): Promise<StoredFile[]> {
  return await db.files
    .where('path')
    .startsWith(directory)
    .toArray();
}
