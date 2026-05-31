import { NextResponse } from 'next/server';
import { listChannels, createChannel } from '@/lib/store';

export async function GET() {
  return NextResponse.json({ channels: listChannels() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, description, createdBy } = body;

  if (!name || !createdBy) {
    return NextResponse.json({ error: 'name and createdBy required' }, { status: 400 });
  }

  try {
    const channel = createChannel({ name, description: description || '', createdBy });
    return NextResponse.json({ channel });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}
