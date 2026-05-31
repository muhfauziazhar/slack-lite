import { randomUUID } from 'crypto';

// ─── Types ────────────────────────────────────────────────────

export interface Channel {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  username: string;
  content: string;
  threadId: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  avatar: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: string;
}

// ─── In-Memory Store ──────────────────────────────────────────

const channels = new Map<string, Channel>();
const messages = new Map<string, Message[]>(); // channelId -> messages
const users = new Map<string, User>();
const channelMembers = new Map<string, Set<string>>(); // channelId -> userIds

// ─── Seed Defaults ────────────────────────────────────────────

function seedDefaults() {
  if (channels.size > 0) return;

  const defaultChannels: Channel[] = [
    { id: 'general', name: 'general', description: 'General discussion', createdBy: 'system', createdAt: new Date().toISOString() },
    { id: 'random', name: 'random', description: 'Random topics and fun stuff', createdBy: 'system', createdAt: new Date().toISOString() },
    { id: 'engineering', name: 'engineering', description: 'Engineering discussions', createdBy: 'system', createdAt: new Date().toISOString() },
    { id: 'design', name: 'design', description: 'Design and UX', createdBy: 'system', createdAt: new Date().toISOString() },
  ];

  for (const ch of defaultChannels) {
    channels.set(ch.id, ch);
    messages.set(ch.id, []);
    channelMembers.set(ch.id, new Set());
  }

  // Seed some demo messages
  const demoMessages: Omit<Message, 'id' | 'createdAt'>[] = [
    { channelId: 'general', userId: 'bot', username: 'SlackBot', content: 'Welcome to Slack Lite! 🎉 This is a self-hosted team chat.', threadId: null },
    { channelId: 'general', userId: 'bot', username: 'SlackBot', content: 'Create channels, send messages, and collaborate with your team.', threadId: null },
    { channelId: 'random', userId: 'bot', username: 'SlackBot', content: 'This is the random channel. Share memes, jokes, and off-topic stuff here! 😄', threadId: null },
    { channelId: 'engineering', userId: 'bot', username: 'SlackBot', content: 'Engineering channel ready. Discuss code, architecture, and tech decisions here.', threadId: null },
  ];

  for (const msg of demoMessages) {
    const fullMsg: Message = {
      ...msg,
      id: randomUUID(),
      createdAt: new Date(Date.now() - 60000).toISOString(),
    };
    messages.get(msg.channelId)!.push(fullMsg);
  }
}

seedDefaults();

// ─── Channel Operations ───────────────────────────────────────

export function listChannels(): Channel[] {
  return Array.from(channels.values());
}

export function getChannel(id: string): Channel | undefined {
  return channels.get(id);
}

export function createChannel(data: { name: string; description: string; createdBy: string }): Channel {
  const id = data.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (channels.has(id)) throw new Error('Channel already exists');

  const channel: Channel = {
    id,
    name: data.name,
    description: data.description,
    createdBy: data.createdBy,
    createdAt: new Date().toISOString(),
  };

  channels.set(id, channel);
  messages.set(id, []);
  channelMembers.set(id, new Set([data.createdBy]));
  return channel;
}

// ─── Message Operations ──────────────────────────────────────

export function listMessages(channelId: string, limit = 100): Message[] {
  return (messages.get(channelId) || []).slice(-limit);
}

export function sendMessage(data: {
  channelId: string;
  userId: string;
  username: string;
  content: string;
  threadId?: string;
}): Message {
  const msg: Message = {
    id: randomUUID(),
    channelId: data.channelId,
    userId: data.userId,
    username: data.username,
    content: data.content,
    threadId: data.threadId || null,
    createdAt: new Date().toISOString(),
  };

  const list = messages.get(data.channelId);
  if (!list) throw new Error('Channel not found');
  list.push(msg);

  // Keep only last 1000 messages per channel
  if (list.length > 1000) list.splice(0, list.length - 1000);

  return msg;
}

export function getThread(channelId: string, threadId: string): Message[] {
  const list = messages.get(channelId) || [];
  return list.filter(m => m.id === threadId || m.threadId === threadId);
}

// ─── User Operations ─────────────────────────────────────────

export function getOrCreateUser(id: string, username: string): User {
  let user = users.get(id);
  if (!user) {
    user = {
      id,
      username,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}`,
      status: 'online',
      lastSeen: new Date().toISOString(),
    };
    users.set(id, user);
  } else {
    user.status = 'online';
    user.lastSeen = new Date().toISOString();
  }
  return user;
}

export function getUser(id: string): User | undefined {
  return users.get(id);
}

export function listOnlineUsers(): User[] {
  return Array.from(users.values()).filter(u => u.status === 'online');
}

export function setUserOffline(id: string) {
  const user = users.get(id);
  if (user) {
    user.status = 'offline';
    user.lastSeen = new Date().toISOString();
  }
}

// ─── SSE Subscribers ─────────────────────────────────────────

type Subscriber = (event: { type: string; data: any }) => void;
const subscribers = new Map<string, Set<Subscriber>>();

export function subscribe(channelId: string, fn: Subscriber): () => void {
  if (!subscribers.has(channelId)) subscribers.set(channelId, new Set());
  subscribers.get(channelId)!.add(fn);
  return () => subscribers.get(channelId)?.delete(fn);
}

export function broadcast(channelId: string, type: string, data: any) {
  const subs = subscribers.get(channelId);
  if (subs) {
    Array.from(subs).forEach(fn => {
      try { fn({ type, data }); } catch {}
    });
  }
}
