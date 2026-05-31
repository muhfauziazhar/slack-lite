import { NextResponse } from 'next/server';
import { listMessages, sendMessage } from '@/lib/store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');

  if (!channelId) {
    return NextResponse.json({ error: 'channelId required' }, { status: 400 });
  }

  try {
    const messages = await listMessages(channelId);
    return NextResponse.json({ messages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { channelId, userId, username, content, threadId } = await request.json();

  if (!channelId || !userId || !username || !content) {
    return NextResponse.json(
      { error: 'channelId, userId, username, content required' },
      { status: 400 }
    );
  }

  try {
    const message = await sendMessage(channelId, userId, username, content, threadId);
    return NextResponse.json({ message });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
