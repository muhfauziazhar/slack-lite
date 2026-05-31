'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────

interface Channel { id: string; name: string; description: string; }
interface Message { id: string; channelId: string; userId: string; username: string; content: string; threadId: string | null; createdAt: string; }

// ─── Helpers ──────────────────────────────────────────────────

function generateId(): string {
  return 'user_' + Math.random().toString(36).substring(2, 8);
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Main Component ──────────────────────────────────────────

export default function Home() {
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string>('general');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Init user
  useEffect(() => {
    const savedId = localStorage.getItem('slacklite_userId');
    const savedName = localStorage.getItem('slacklite_username');
    if (savedId && savedName) {
      setUserId(savedId);
      setUsername(savedName);
      setJoined(true);
    }
  }, []);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    const res = await fetch('/api/channels');
    const data = await res.json();
    setChannels(data.channels || []);
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async (channelId: string) => {
    const res = await fetch(`/api/messages?channelId=${channelId}`);
    const data = await res.json();
    setMessages(data.messages || []);
  }, []);

  // SSE subscription
  useEffect(() => {
    if (!joined || !activeChannel) return;

    fetchMessages(activeChannel);

    const es = new EventSource(`/api/sse?channelId=${activeChannel}`);

    es.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        if (type === 'new_message') {
          setMessages(prev => [...prev, data]);
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 3s
      setTimeout(() => fetchMessages(activeChannel), 3000);
    };

    return () => es.close();
  }, [joined, activeChannel, fetchMessages]);

  // Fetch channels on join
  useEffect(() => {
    if (joined) fetchChannels();
  }, [joined, fetchChannels]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Join
  const handleJoin = () => {
    if (!username.trim()) return;
    const id = generateId();
    setUserId(id);
    localStorage.setItem('slacklite_userId', id);
    localStorage.setItem('slacklite_username', username.trim());
    setJoined(true);
  };

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || !userId) return;
    const content = input.trim();
    setInput('');

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: activeChannel,
        userId,
        username,
        content,
      }),
    });

    inputRef.current?.focus();
  };

  // Create channel
  const createChannel = async () => {
    if (!newChannelName.trim()) return;
    await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newChannelName.trim(), description: '', createdBy: userId }),
    });
    setNewChannelName('');
    setShowCreate(false);
    fetchChannels();
  };

  // ─── Login Screen ──────────────────────────────────────────

  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">💬</div>
            <h1 className="text-2xl font-bold">Slack Lite</h1>
            <p className="text-gray-400 text-sm mt-1">Self-hosted team chat. Zero signup.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Your display name</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="e.g. Fauzi"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                autoFocus
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={!username.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg py-3 font-medium transition-colors"
            >
              Join Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Chat Screen ────────────────────────────────────────────

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex overflow-hidden">
      {/* Sidebar */}
      <aside className={`w-64 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0 ${sidebarOpen ? 'fixed inset-0 z-30 md:relative' : 'hidden md:flex'}`}>
        {/* Workspace header */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-lg">💬 Slack Lite</h1>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400">✕</button>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Self-hosted team chat</p>
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto py-3">
          <div className="px-4 mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Channels</span>
            <button onClick={() => setShowCreate(!showCreate)} className="text-gray-500 hover:text-white text-lg leading-none">+</button>
          </div>

          {/* Create channel form */}
          {showCreate && (
            <div className="px-4 mb-2 flex gap-1">
              <input
                type="text"
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createChannel()}
                placeholder="channel-name"
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
              <button onClick={createChannel} className="text-emerald-400 text-sm px-2">✓</button>
            </div>
          )}

          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => { setActiveChannel(ch.id); setSidebarOpen(false); }}
              className={`w-full text-left px-4 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                activeChannel === ch.id ? 'bg-emerald-600/20 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="text-gray-500">#</span>
              {ch.name}
            </button>
          ))}
        </div>

        {/* User */}
        <div className="px-4 py-3 border-t border-gray-800 flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">
            {username[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{username}</div>
            <div className="text-xs text-emerald-400">● online</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        <header className="px-4 py-2 border-b border-gray-800 flex items-center gap-3 bg-gray-900/50">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-400 text-xl">☰</button>
          <div>
            <h2 className="font-semibold flex items-center gap-1">
              <span className="text-gray-500">#</span> {channels.find(c => c.id === activeChannel)?.name || activeChannel}
            </h2>
            <p className="text-xs text-gray-500">{channels.find(c => c.id === activeChannel)?.description}</p>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <div className="text-4xl mb-2">#</div>
              <p className="font-medium">No messages yet</p>
              <p className="text-sm">Be the first to say something!</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const prev = messages[i - 1];
            const isGrouped = prev && prev.userId === msg.userId &&
              new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 60000;

            return (
              <div key={msg.id} className={`flex gap-3 ${isGrouped ? 'pt-0' : ''}`}>
                {!isGrouped ? (
                  <div className="w-9 h-9 bg-gray-700 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    {msg.username[0]?.toUpperCase()}
                  </div>
                ) : (
                  <div className="w-9 flex-shrink-0 flex items-center justify-center">
                    <span className="text-[10px] text-gray-600 opacity-0 hover:opacity-100 transition-opacity">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {!isGrouped && (
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm">{msg.username}</span>
                      <span className="text-xs text-gray-500">{formatTime(msg.createdAt)}</span>
                    </div>
                  )}
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2">
          <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder={`Message #${channels.find(c => c.id === activeChannel)?.name || activeChannel}`}
              className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none"
              autoFocus
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-4 py-3 text-emerald-400 hover:text-emerald-300 disabled:text-gray-600 transition-colors"
            >
              ➤
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
