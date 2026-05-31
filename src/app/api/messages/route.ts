import { NextResponse } from 'next/server';
import { listMessages, sendMessage, broadcast } from '@/lib/store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');
  const limit = parseInt(searchParams.get('limit') || '100');

  if (!channelId) {
    return NextResponse.json({ error: 'channelId required' }, { status: 400 });
  }

  return NextResponse.json({ messages: listMessages(channelId, limit) });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { channelId, userId, username, content, threadId } = body;

  if (!channelId || !userId || !content) {
    return NextResponse.json({ error: 'channelId, userId, and content required' }, { status: 400 });
  }

  const message = sendMessage({ channelId, userId, username: username || 'Anonymous', content, threadId });

  // Broadcast to SSE subscribers
  broadcast(channelId, 'new_message', message);

  return NextResponse.json({ message });
}
