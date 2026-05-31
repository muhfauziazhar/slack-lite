import { Pool } from 'pg';

// ─── Database ─────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_rwq2biR8uNZQ@ep-cold-meadow-aod4cxb5-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ─── Types ────────────────────────────────────────────────────

export interface Channel {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
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

// ─── SSE Subscribers ─────────────────────────────────────────

type Subscriber = (event: { type: string; data: any }) => void;
const subscribers = new Map<string, Set<Subscriber>>();

export function subscribe(channelId: string, fn: Subscriber): () => void {
  if (!subscribers.has(channelId)) subscribers.set(channelId, new Set());
  subscribers.get(channelId)!.add(fn);
  return () => {
    subscribers.get(channelId)?.delete(fn);
    if (subscribers.get(channelId)?.size === 0) subscribers.delete(channelId);
  };
}

export function broadcast(channelId: string, type: string, data: any) {
  const subs = subscribers.get(channelId);
  if (subs) {
    Array.from(subs).forEach(fn => {
      try { fn({ type, data }); } catch {}
    });
  }
}

// ─── Channels ────────────────────────────────────────────────

export async function listChannels(): Promise<Channel[]> {
  const result = await pool.query(
    'SELECT * FROM channels ORDER BY created_at ASC'
  );
  return result.rows;
}

export async function createChannel(name: string, description: string, createdBy: string): Promise<Channel> {
  const id = 'ch_' + name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const result = await pool.query(
    `INSERT INTO channels (id, name, description, created_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
     RETURNING *`,
    [id, name, description || '', createdBy]
  );
  return result.rows[0];
}

export async function getChannel(id: string): Promise<Channel | null> {
  const result = await pool.query('SELECT * FROM channels WHERE id = $1', [id]);
  return result.rows[0] || null;
}

// ─── Messages ────────────────────────────────────────────────

export async function listMessages(channelId: string, limit = 100): Promise<Message[]> {
  const result = await pool.query(
    `SELECT id, channel_id as "channelId", user_id as "userId", username,
            content, thread_id as "threadId", created_at as "createdAt"
     FROM messages
     WHERE channel_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [channelId, limit]
  );
  return result.rows;
}

export async function sendMessage(
  channelId: string,
  userId: string,
  username: string,
  content: string,
  threadId?: string
): Promise<Message> {
  const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const result = await pool.query(
    `INSERT INTO messages (id, channel_id, user_id, username, content, thread_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, channel_id as "channelId", user_id as "userId", username,
               content, thread_id as "threadId", created_at as "createdAt"`,
    [id, channelId, userId, username, content, threadId || null]
  );
  const msg = result.rows[0];
  broadcast(channelId, 'new_message', msg);
  return msg;
}

export async function getStats(): Promise<{ channels: number; messages: number }> {
  const ch = await pool.query('SELECT COUNT(*) FROM channels');
  const msg = await pool.query('SELECT COUNT(*) FROM messages');
  return {
    channels: parseInt(ch.rows[0].count),
    messages: parseInt(msg.rows[0].count),
  };
}
