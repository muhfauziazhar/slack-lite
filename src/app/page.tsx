'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Hash, Plus, Send, Users, MessageSquare, ArrowLeft, Settings, Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface Channel { id: string; name: string; description: string; }
interface Message { id: string; channelId: string; userId: string; username: string; content: string; threadId: string | null; createdAt: string; }

// ─── Helpers ──────────────────────────────────────────────────

function generateId(): string {
  return 'user_' + Math.random().toString(36).substring(2, 8);
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getInitial(name: string): string {
  return name[0]?.toUpperCase() || '?';
}

// Color palette for user avatars
const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
  'from-fuchsia-500 to-rose-600',
  'from-lime-500 to-green-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
  const [sending, setSending] = useState(false);
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
    try {
      const res = await fetch(`/api/messages?channelId=${channelId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {}
  }, []);

  // Poll messages every 3s (SSE unreliable on Vercel)
  useEffect(() => {
    if (!joined || !activeChannel) return;

    fetchMessages(activeChannel);
    const interval = setInterval(() => fetchMessages(activeChannel), 3000);
    return () => clearInterval(interval);
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
    if (!input.trim() || !userId || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: activeChannel, userId, username, content }),
    });

    // Immediately fetch messages so it appears without waiting for poll
    if (res.ok) {
      await fetchMessages(activeChannel);
    }

    setSending(false);
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-violet-500/30">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/20">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Slack Lite</h1>
            <p className="text-slate-500 text-sm mt-1">Self-hosted team chat. Zero signup.</p>
          </div>

          {/* Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Display name
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="e.g. Fauzi"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors duration-150"
                autoFocus
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={!username.trim()}
              className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed rounded-lg py-3 font-medium transition-colors duration-150 cursor-pointer"
            >
              Join Chat
            </button>
          </div>

          <p className="text-center text-xs text-slate-600 mt-4">
            No account required. Just pick a name and start chatting.
          </p>
        </div>
      </div>
    );
  }

  // ─── Chat Screen ────────────────────────────────────────────

  const currentChannel = channels.find(c => c.id === activeChannel);

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex overflow-hidden selection:bg-violet-500/30">
      {/* Sidebar overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 bg-slate-900 border-r border-slate-800/80 flex flex-col flex-shrink-0
        ${sidebarOpen ? 'fixed inset-y-0 left-0 z-30 md:relative' : 'hidden md:flex'}
      `}>
        {/* Workspace header */}
        <div className="px-4 h-14 flex items-center justify-between border-b border-slate-800/80 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm">Slack Lite</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-md hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto py-3">
          <div className="px-3 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">Channels</span>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="p-1 rounded-md hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* Create channel form */}
          {showCreate && (
            <div className="px-3 mb-2 flex gap-1.5">
              <div className="flex items-center gap-1.5 flex-1 bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <input
                  type="text"
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && createChannel()}
                  placeholder="channel-name"
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none min-w-0"
                  autoFocus
                />
              </div>
              <button
                onClick={createChannel}
                className="px-2.5 rounded-md bg-violet-600 hover:bg-violet-500 transition-colors duration-150 cursor-pointer text-sm font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Channel list */}
          <div className="px-2 space-y-0.5">
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => { setActiveChannel(ch.id); setSidebarOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors duration-150 cursor-pointer ${
                  activeChannel === ch.id
                    ? 'bg-violet-600/15 text-violet-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Hash className={`w-4 h-4 flex-shrink-0 ${activeChannel === ch.id ? 'text-violet-400' : 'text-slate-600'}`} />
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User */}
        <div className="px-3 py-3 border-t border-slate-800/80 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-1">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getAvatarColor(username)} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
              {getInitial(username)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{username}</div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                <span className="text-[11px] text-slate-500">online</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        <header className="h-14 px-4 border-b border-slate-800/80 flex items-center gap-3 flex-shrink-0 bg-slate-950">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
          >
            <MessageSquare className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Hash className="w-5 h-5 text-slate-500 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate">{currentChannel?.name || activeChannel}</h2>
              {currentChannel?.description && (
                <p className="text-[11px] text-slate-500 truncate">{currentChannel.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
              <Users className="w-3.5 h-3.5" />
              <span>1</span>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
                <Hash className="w-8 h-8 text-slate-700" />
              </div>
              <p className="font-medium text-slate-400 mb-1">No messages yet</p>
              <p className="text-sm text-slate-600">Be the first to say something in #{currentChannel?.name || activeChannel}!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((msg, i) => {
                const prev = messages[i - 1];
                const isGrouped = prev && prev.userId === msg.userId &&
                  new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 60000;

                return (
                  <div key={msg.id} className={`group flex gap-3 px-2 py-1 rounded-lg hover:bg-slate-900/50 transition-colors duration-100 ${isGrouped ? 'mt-0' : 'mt-3'}`}>
                    {!isGrouped ? (
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getAvatarColor(msg.username)} flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5`}>
                        {getInitial(msg.username)}
                      </div>
                    ) : (
                      <div className="w-9 flex-shrink-0 flex items-center justify-center">
                        <span className="text-[10px] text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150 tabular-nums">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {!isGrouped && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-slate-200">{msg.username}</span>
                          <span className="text-[11px] text-slate-600 tabular-nums">{formatTime(msg.createdAt)}</span>
                        </div>
                      )}
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 flex-shrink-0">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl overflow-hidden focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all duration-150">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder={`Message #${currentChannel?.name || activeChannel}`}
              className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none"
              autoFocus
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="px-3.5 py-3 text-violet-400 hover:text-violet-300 disabled:text-slate-700 transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-700 mt-1.5 px-1">
            Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-500 text-[10px] font-mono">Enter</kbd> to send
          </p>
        </div>
      </main>
    </div>
  );
}
