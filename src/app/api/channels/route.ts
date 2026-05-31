import { NextResponse } from 'next/server';
import { listChannels, createChannel } from '@/lib/store';

export async function GET() {
  try {
    const channels = await listChannels();
    return NextResponse.json({ channels });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, description, createdBy } = await request.json();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const channel = await createChannel(name, description || '', createdBy || 'anonymous');
    return NextResponse.json({ channel });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}
