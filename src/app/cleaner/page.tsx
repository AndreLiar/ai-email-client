'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type SenderRow = {
  displayName: string;
  email: string;
  count: number;
  sampleMessageId: string;
  canAutoUnsubscribe: boolean;
  category?: string;
};

type ScanResult = {
  senders: SenderRow[];
  totalScanned: number;
};

type SenderStatus = 'idle' | 'deleting' | 'unsubscribing' | 'done' | 'error';

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  newsletter:    { bg: 'rgba(0,217,126,0.15)',  color: '#00d97e' },
  job_alert:     { bg: 'rgba(255,189,46,0.15)', color: '#ffbd2e' },
  promo:         { bg: 'rgba(255,95,87,0.15)',  color: '#ff5f57' },
  social:        { bg: 'rgba(90,130,255,0.15)', color: '#7a9aff' },
  transactional: { bg: 'rgba(0,200,180,0.15)',  color: '#00c8b4' },
  other:         { bg: 'rgba(120,120,140,0.15)',color: '#888899' },
};

export default function CleanerPage() {
  const router = useRouter();
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [senderStatuses, setSenderStatuses] = useState<Record<string, SenderStatus>>({});
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(d => setGmailConnected(d.connected));
  }, []);

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: '/api/agent/cleaner' }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const scanInbox = async () => {
    setScanning(true);
    setScanResult(null);
    setSelected(new Set());
    setSenderStatuses({});
    setActionLog([]);
    try {
      const res = await fetch('/api/agent/scan-senders');
      const data = await res.json();
      setScanResult(data);
      log(`Scanned ${data.totalScanned} emails — ${data.senders.length} unique senders found.`);
    } catch {
      log('Error scanning inbox.');
    } finally {
      setScanning(false);
    }
  };

  const log = (msg: string) =>
    setActionLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const toggleSelect = (email: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!scanResult) return;
    selected.size === scanResult.senders.length
      ? setSelected(new Set())
      : setSelected(new Set(scanResult.senders.map(s => s.email)));
  };

  const setStatus = (email: string, s: SenderStatus) =>
    setSenderStatuses(prev => ({ ...prev, [email]: s }));

  const trashSender = async (email: string) => {
    setStatus(email, 'deleting');
    try {
      const res = await fetch('/api/agent/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderEmail: email }),
      });
      const data = await res.json();
      setStatus(email, 'done');
      log(`✕ Trashed ${data.deleted} email(s) from ${email}`);
    } catch {
      setStatus(email, 'error');
      log(`✕ Failed to delete emails from ${email}`);
    }
  };

  const unsubAndTrashSender = async (sender: SenderRow) => {
    setStatus(sender.email, 'unsubscribing');
    try {
      const res = await fetch('/api/agent/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: sender.sampleMessageId }),
      });
      const data = await res.json();
      if (data.method === 'one-click-post') log(`✓ Unsubscribed from ${sender.email} (one-click)`);
      else if (data.method === 'mailto') log(`✓ Unsubscribe email sent to ${data.to}`);
      else if (data.method === 'link') log(`→ Manual unsubscribe: ${data.url}`);
      else log(`— No unsubscribe option for ${sender.email}`);
    } catch {
      log(`✕ Unsubscribe failed for ${sender.email}`);
    }
    await trashSender(sender.email);
  };

  const deleteSelected = async () => { for (const e of [...selected]) await trashSender(e); };
  const unsubscribeAndDeleteSelected = async () => {
    for (const e of [...selected]) {
      const s = scanResult?.senders.find(x => x.email === e);
      if (s) await unsubAndTrashSender(s);
    }
  };

  const getMessageText = (message: (typeof messages)[0]) =>
    message.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('');

  const selectedCount = selected.size;
  const doneCount = Object.values(senderStatuses).filter(s => s === 'done').length;

  async function handleDisconnect() {
    await fetch('/api/auth/disconnect', { method: 'POST' });
    router.push('/');
  }

  // ── Shared dark shell ────────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        .cl-root {
          background: #06090f;
          color: #c8d8cc;
          font-family: var(--font-syne), sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }
        .cl-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(0,217,126,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,217,126,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          z-index: 0;
        }
        .cl-nav {
          position: relative;
          z-index: 10;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 3rem;
          border-bottom: 1px solid rgba(0,217,126,0.1);
        }
        .cl-logo {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.9rem;
          color: #00d97e;
          text-decoration: none;
          letter-spacing: 0.05em;
        }
        .cl-logo span { color: #c8d8cc; }
        .cl-nav-actions { display: flex; align-items: center; gap: 1rem; }
        .cl-btn-ghost {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.7rem;
          padding: 0.4rem 1rem;
          background: transparent;
          border: 1px solid rgba(200,216,204,0.2);
          color: #7a9a84;
          cursor: pointer;
          letter-spacing: 0.08em;
          transition: border-color 0.2s, color 0.2s;
        }
        .cl-btn-ghost:hover { border-color: #ff5f57; color: #ff5f57; }
        .cl-btn-primary {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          padding: 0.6rem 1.5rem;
          background: #00d97e;
          color: #06090f;
          border: none;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 0 20px rgba(0,217,126,0.2);
        }
        .cl-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 0 35px rgba(0,217,126,0.4);
        }
        .cl-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .cl-content {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 2.5rem 3rem;
        }
        @media (max-width: 768px) {
          .cl-nav { padding: 1rem 1.25rem; }
          .cl-content { padding: 1.5rem 1.25rem; }
        }
      `}</style>
      <div className="cl-root">
        <nav className="cl-nav">
          <Link href="/" className="cl-logo">clean<span>inbox</span>.ai</Link>
          <div className="cl-nav-actions">
            <button className="cl-btn-ghost" onClick={handleDisconnect}>
              DISCONNECT GMAIL
            </button>
          </div>
        </nav>
        <div className="cl-content">{children}</div>
      </div>
    </>
  );

  // ── Loading state ────────────────────────────────────────────────────────
  if (gmailConnected === null) {
    return (
      <Shell>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 40, height: 40, border: '2px solid rgba(0,217,126,0.2)',
              borderTopColor: '#00d97e', borderRadius: '50%',
              animation: 'cl-spin 0.8s linear infinite', margin: '0 auto 1rem'
            }} />
            <style>{`@keyframes cl-spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.72rem', color: '#4a6a54', letterSpacing: '0.1em' }}>
              INITIALIZING...
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Connect Gmail state ──────────────────────────────────────────────────
  if (!gmailConnected) {
    return (
      <Shell>
        <style>{`
          .cl-connect-wrap {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 70vh;
          }
          .cl-connect-card {
            background: #0b1018;
            border: 1px solid rgba(0,217,126,0.15);
            padding: 4rem 3.5rem;
            text-align: center;
            max-width: 480px;
            width: 100%;
            position: relative;
            overflow: hidden;
          }
          .cl-connect-card::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(ellipse 70% 50% at 50% 100%, rgba(0,217,126,0.06) 0%, transparent 70%);
            pointer-events: none;
          }
          .cl-connect-icon {
            font-size: 3rem;
            margin-bottom: 1.5rem;
            filter: drop-shadow(0 0 20px rgba(0,217,126,0.4));
          }
          .cl-connect-tag {
            font-family: var(--font-space-mono), monospace;
            font-size: 0.65rem;
            letter-spacing: 0.2em;
            color: #00d97e;
            text-transform: uppercase;
            margin-bottom: 1rem;
          }
          .cl-connect-h {
            font-size: 1.8rem;
            font-weight: 800;
            color: #f0f7f2;
            letter-spacing: -0.02em;
            margin-bottom: 0.75rem;
          }
          .cl-connect-sub {
            font-size: 0.875rem;
            color: #4a6a54;
            line-height: 1.7;
            margin-bottom: 2.5rem;
          }
          .cl-connect-btn {
            display: inline-block;
            font-family: var(--font-space-mono), monospace;
            font-size: 0.78rem;
            letter-spacing: 0.1em;
            padding: 0.9rem 2.5rem;
            background: #00d97e;
            color: #06090f;
            text-decoration: none;
            font-weight: 700;
            border: none;
            box-shadow: 0 0 40px rgba(0,217,126,0.3);
            transition: transform 0.15s, box-shadow 0.15s;
          }
          .cl-connect-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 0 60px rgba(0,217,126,0.5);
            color: #06090f;
          }
          .cl-perms {
            margin-top: 2rem;
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
          }
          .cl-perm-item {
            font-family: var(--font-space-mono), monospace;
            font-size: 0.65rem;
            color: #2a4a34;
            letter-spacing: 0.05em;
          }
          .cl-perm-item::before { content: '✓  '; color: #00d97e; }
        `}</style>
        <div className="cl-connect-wrap">
          <div className="cl-connect-card">
            <div className="cl-connect-icon">📬</div>
            <p className="cl-connect-tag">// gmail_oauth</p>
            <h2 className="cl-connect-h">Connect your Gmail</h2>
            <p className="cl-connect-sub">
              Grant the agent read and modify access to scan senders,
              unsubscribe from lists, and bulk-delete emails.
            </p>
            <a href="/api/auth/gmail-connect" className="cl-connect-btn">
              CONNECT GMAIL →
            </a>
            <div className="cl-perms">
              <span className="cl-perm-item">Read and modify emails</span>
              <span className="cl-perm-item">Send unsubscribe requests</span>
              <span className="cl-perm-item">Tokens stored in HTTP-only cookies</span>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Main cleaner UI ──────────────────────────────────────────────────────
  return (
    <Shell>
      <style>{`
        .cl-page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .cl-page-tag {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.65rem;
          letter-spacing: 0.2em;
          color: #00d97e;
          text-transform: uppercase;
          margin-bottom: 0.4rem;
        }
        .cl-page-title {
          font-size: 1.8rem;
          font-weight: 800;
          color: #f0f7f2;
          letter-spacing: -0.02em;
          margin: 0 0 0.25rem;
        }
        .cl-page-sub {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.7rem;
          color: #4a6a54;
          letter-spacing: 0.05em;
        }
        .cl-header-actions { display: flex; gap: 0.75rem; align-items: center; }
        .cl-btn-outline {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          padding: 0.55rem 1.25rem;
          background: transparent;
          border: 1px solid rgba(0,217,126,0.3);
          color: #00d97e;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .cl-btn-outline:hover { background: rgba(0,217,126,0.08); border-color: #00d97e; }
        .cl-btn-outline:disabled { opacity: 0.3; cursor: not-allowed; }

        /* ── chat panel ── */
        .cl-chat-panel {
          background: #0b1018;
          border: 1px solid rgba(0,217,126,0.15);
          margin-bottom: 2rem;
          overflow: hidden;
        }
        .cl-chat-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.65rem 1rem;
          background: #0f1a20;
          border-bottom: 1px solid rgba(0,217,126,0.1);
        }
        .cl-chat-bar-dots { display: flex; gap: 6px; }
        .cl-dot { width: 10px; height: 10px; border-radius: 50%; }
        .cl-dot-r { background: #ff5f57; }
        .cl-dot-y { background: #ffbd2e; }
        .cl-dot-g { background: #28c840; }
        .cl-chat-bar-title {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.65rem;
          color: #4a6a54;
          letter-spacing: 0.05em;
        }
        .cl-chat-body {
          height: 280px;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .cl-chat-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          font-family: var(--font-space-mono), monospace;
          font-size: 0.7rem;
          color: #2a4a34;
          letter-spacing: 0.08em;
          text-align: center;
          gap: 0.5rem;
        }
        .cl-msg-user { display: flex; justify-content: flex-end; }
        .cl-msg-agent { display: flex; justify-content: flex-start; }
        .cl-msg-bubble {
          max-width: 80%;
          padding: 0.6rem 0.9rem;
          font-size: 0.82rem;
          line-height: 1.6;
        }
        .cl-msg-bubble-user {
          background: rgba(0,217,126,0.12);
          border: 1px solid rgba(0,217,126,0.2);
          color: #c8d8cc;
        }
        .cl-msg-bubble-agent {
          background: #0f1a20;
          border: 1px solid rgba(0,217,126,0.08);
          color: #7a9a84;
        }
        .cl-msg-bubble-agent p { margin: 0 0 0.4rem; }
        .cl-msg-bubble-agent p:last-child { margin: 0; }
        .cl-msg-bubble-agent code {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.75rem;
          color: #00d97e;
          background: rgba(0,217,126,0.08);
          padding: 0.1rem 0.3rem;
        }
        .cl-msg-label {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.58rem;
          letter-spacing: 0.1em;
          margin-bottom: 0.3rem;
          padding: 0 0.2rem;
        }
        .cl-msg-label-user { color: #00d97e; text-align: right; }
        .cl-msg-label-agent { color: #4a6a54; }
        .cl-thinking {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-space-mono), monospace;
          font-size: 0.68rem;
          color: #4a6a54;
          letter-spacing: 0.08em;
          padding: 0.25rem 0;
        }
        .cl-thinking-dot {
          width: 5px; height: 5px; border-radius: 50%; background: #00d97e;
          animation: cl-pulse 1.2s ease-in-out infinite;
        }
        .cl-thinking-dot:nth-child(2) { animation-delay: 0.2s; }
        .cl-thinking-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes cl-pulse { 0%,100%{opacity:0.2} 50%{opacity:1} }
        .cl-chat-footer {
          border-top: 1px solid rgba(0,217,126,0.08);
          padding: 0.75rem 1rem;
        }
        .cl-chat-input-row { display: flex; gap: 0.5rem; margin-bottom: 0.6rem; }
        .cl-chat-input {
          flex: 1;
          background: #06090f;
          border: 1px solid rgba(0,217,126,0.2);
          color: #c8d8cc;
          padding: 0.5rem 0.75rem;
          font-family: var(--font-space-mono), monospace;
          font-size: 0.72rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .cl-chat-input:focus { border-color: rgba(0,217,126,0.5); }
        .cl-chat-input::placeholder { color: #2a4a34; }
        .cl-suggestions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
        .cl-suggestion {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.62rem;
          letter-spacing: 0.05em;
          padding: 0.3rem 0.7rem;
          background: transparent;
          border: 1px solid rgba(0,217,126,0.15);
          color: #4a6a54;
          cursor: pointer;
          transition: border-color 0.2s, color 0.2s;
        }
        .cl-suggestion:hover:not(:disabled) { border-color: rgba(0,217,126,0.4); color: #00d97e; }
        .cl-suggestion:disabled { opacity: 0.3; cursor: not-allowed; }

        /* ── scan results ── */
        .cl-scan-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .cl-scan-meta {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.68rem;
          color: #4a6a54;
          letter-spacing: 0.05em;
        }
        .cl-scan-meta strong { color: #00d97e; }
        .cl-scan-meta .cl-done { color: #00d97e; margin-left: 0.75rem; }
        .cl-bulk-actions { display: flex; gap: 0.5rem; }
        .cl-btn-trash {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.68rem;
          letter-spacing: 0.06em;
          padding: 0.45rem 1rem;
          background: transparent;
          border: 1px solid rgba(255,95,87,0.35);
          color: #ff5f57;
          cursor: pointer;
          transition: background 0.2s;
        }
        .cl-btn-trash:hover:not(:disabled) { background: rgba(255,95,87,0.1); }
        .cl-btn-trash:disabled { opacity: 0.3; cursor: not-allowed; }
        .cl-btn-unsub {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.68rem;
          letter-spacing: 0.06em;
          padding: 0.45rem 1rem;
          background: rgba(255,95,87,0.1);
          border: 1px solid rgba(255,95,87,0.5);
          color: #ff7a74;
          cursor: pointer;
          transition: background 0.2s;
        }
        .cl-btn-unsub:hover:not(:disabled) { background: rgba(255,95,87,0.2); }
        .cl-btn-unsub:disabled { opacity: 0.3; cursor: not-allowed; }

        /* ── table ── */
        .cl-table-wrap {
          background: #0b1018;
          border: 1px solid rgba(0,217,126,0.1);
          overflow: hidden;
        }
        .cl-table { width: 100%; border-collapse: collapse; }
        .cl-table thead tr {
          border-bottom: 1px solid rgba(0,217,126,0.1);
          background: #0f1a20;
        }
        .cl-table th {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.6rem;
          letter-spacing: 0.12em;
          color: #4a6a54;
          text-transform: uppercase;
          padding: 0.75rem 1rem;
          font-weight: 400;
          text-align: left;
        }
        .cl-table td {
          padding: 0.7rem 1rem;
          border-bottom: 1px solid rgba(0,217,126,0.05);
          vertical-align: middle;
        }
        .cl-table tbody tr { transition: background 0.15s; }
        .cl-table tbody tr:hover { background: rgba(0,217,126,0.02); }
        .cl-table tbody tr.cl-row-done { background: rgba(0,217,126,0.04); }
        .cl-table tbody tr:last-child td { border-bottom: none; }
        .cl-sender-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: #c8d8cc;
          line-height: 1.3;
        }
        .cl-sender-email {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.65rem;
          color: #4a6a54;
          margin-top: 0.15rem;
        }
        .cl-count-badge {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.68rem;
          padding: 0.2rem 0.5rem;
          border: 1px solid rgba(0,217,126,0.2);
          color: #00d97e;
          background: rgba(0,217,126,0.08);
        }
        .cl-cat-badge {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.6rem;
          letter-spacing: 0.06em;
          padding: 0.2rem 0.5rem;
          text-transform: uppercase;
        }
        .cl-unsub-auto {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.6rem;
          letter-spacing: 0.06em;
          color: #00d97e;
          padding: 0.2rem 0.5rem;
          border: 1px solid rgba(0,217,126,0.3);
          background: rgba(0,217,126,0.06);
        }
        .cl-unsub-manual {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.6rem;
          letter-spacing: 0.06em;
          color: #ffbd2e;
          padding: 0.2rem 0.5rem;
          border: 1px solid rgba(255,189,46,0.3);
          background: rgba(255,189,46,0.06);
        }
        .cl-status-idle { font-family: var(--font-space-mono),monospace; font-size:0.68rem; color:#2a4a34; }
        .cl-status-working { font-family: var(--font-space-mono),monospace; font-size:0.68rem; color:#ffbd2e; display:flex; align-items:center; gap:0.4rem; }
        .cl-status-done { font-family: var(--font-space-mono),monospace; font-size:0.68rem; color:#00d97e; }
        .cl-status-error { font-family: var(--font-space-mono),monospace; font-size:0.68rem; color:#ff5f57; }
        .cl-row-actions { display: flex; gap: 0.4rem; }
        .cl-act-btn {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.58rem;
          letter-spacing: 0.05em;
          padding: 0.25rem 0.55rem;
          background: transparent;
          cursor: pointer;
          transition: background 0.15s;
        }
        .cl-act-trash {
          border: 1px solid rgba(255,95,87,0.3);
          color: #ff5f57;
        }
        .cl-act-trash:hover:not(:disabled) { background: rgba(255,95,87,0.1); }
        .cl-act-unsub {
          border: 1px solid rgba(0,217,126,0.2);
          color: #00d97e;
        }
        .cl-act-unsub:hover:not(:disabled) { background: rgba(0,217,126,0.08); }
        .cl-act-btn:disabled { opacity: 0.25; cursor: not-allowed; }
        .cl-checkbox {
          appearance: none;
          width: 14px;
          height: 14px;
          border: 1px solid rgba(0,217,126,0.3);
          background: transparent;
          cursor: pointer;
          position: relative;
          transition: border-color 0.15s, background 0.15s;
        }
        .cl-checkbox:checked {
          background: #00d97e;
          border-color: #00d97e;
        }
        .cl-checkbox:checked::after {
          content: '';
          position: absolute;
          left: 3px; top: 1px;
          width: 5px; height: 8px;
          border: 2px solid #06090f;
          border-top: none; border-left: none;
          transform: rotate(45deg);
        }

        /* ── action log ── */
        .cl-log {
          margin-top: 2rem;
        }
        .cl-log-header {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.6rem;
          letter-spacing: 0.15em;
          color: #4a6a54;
          text-transform: uppercase;
          margin-bottom: 0.5rem;
        }
        .cl-log-body {
          background: #06090f;
          border: 1px solid rgba(0,217,126,0.1);
          padding: 1rem;
          font-family: var(--font-space-mono), monospace;
          font-size: 0.7rem;
          color: #4a6a54;
          max-height: 180px;
          overflow-y: auto;
          line-height: 1.8;
        }
        .cl-log-line { color: #5a8a64; }
        .cl-log-line:nth-child(1) { color: #00d97e; }

        /* ── empty state ── */
        .cl-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 50vh;
          text-align: center;
          gap: 1rem;
        }
        .cl-empty-icon {
          font-size: 3.5rem;
          filter: drop-shadow(0 0 20px rgba(0,217,126,0.3));
        }
        .cl-empty-title {
          font-size: 1.4rem;
          font-weight: 800;
          color: #f0f7f2;
          letter-spacing: -0.01em;
        }
        .cl-empty-sub {
          font-size: 0.875rem;
          color: #4a6a54;
          max-width: 360px;
          line-height: 1.7;
        }
        .cl-empty-hint {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.68rem;
          color: #2a4a34;
          letter-spacing: 0.05em;
          max-width: 420px;
          line-height: 1.8;
        }
        .cl-empty-hint em { color: #4a6a54; font-style: normal; }
      `}</style>

      {/* ── Page header ── */}
      <div className="cl-page-header">
        <div>
          <p className="cl-page-tag">// inbox_cleaner</p>
          <h1 className="cl-page-title">Inbox Cleaner</h1>
          <p className="cl-page-sub">scan → classify → unsubscribe → trash</p>
        </div>
        <div className="cl-header-actions">
          <button
            className="cl-btn-outline"
            onClick={() => setShowChat(v => !v)}
          >
            {showChat ? 'HIDE AGENT' : '✦ ASK AI AGENT'}
          </button>
          <button
            className="cl-btn-primary"
            onClick={scanInbox}
            disabled={scanning}
          >
            {scanning ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  width: 10, height: 10,
                  border: '1.5px solid rgba(6,9,15,0.3)',
                  borderTopColor: '#06090f',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'cl-spin 0.7s linear infinite',
                }} />
                SCANNING...
              </span>
            ) : 'SCAN INBOX'}
          </button>
        </div>
      </div>

      {/* ── AI Agent Chat ── */}
      {showChat && (
        <div className="cl-chat-panel">
          <div className="cl-chat-bar">
            <div className="cl-chat-bar-dots">
              <div className="cl-dot cl-dot-r" />
              <div className="cl-dot cl-dot-y" />
              <div className="cl-dot cl-dot-g" />
            </div>
            <span className="cl-chat-bar-title">agent — gemini-1.5-flash · vercel ai sdk v6</span>
            <div style={{ width: 46 }} />
          </div>
          <div className="cl-chat-body">
            {messages.length === 0 && (
              <div className="cl-chat-empty">
                <span style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 0 10px rgba(0,217,126,0.3))' }}>◈</span>
                <span>ASK THE AGENT TO SCAN, CLASSIFY, OR CLEAN YOUR INBOX</span>
              </div>
            )}
            {messages.map(m => {
              const text = getMessageText(m);
              if (!text) return null;
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className={isUser ? 'cl-msg-user' : 'cl-msg-agent'}>
                  <div>
                    <div className={`cl-msg-label ${isUser ? 'cl-msg-label-user' : 'cl-msg-label-agent'}`}>
                      {isUser ? 'YOU' : 'AGENT'}
                    </div>
                    <div className={`cl-msg-bubble ${isUser ? 'cl-msg-bubble-user' : 'cl-msg-bubble-agent'}`}>
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="cl-thinking">
                <div className="cl-thinking-dot" />
                <div className="cl-thinking-dot" />
                <div className="cl-thinking-dot" />
                <span>AGENT IS WORKING</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
          <div className="cl-chat-footer">
            <form
              className="cl-chat-input-row"
              onSubmit={e => {
                e.preventDefault();
                if (!chatInput.trim() || isLoading) return;
                sendMessage({ text: chatInput });
                setChatInput('');
              }}
            >
              <input
                className="cl-chat-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder='e.g. "scan my inbox and delete all job alerts"'
              />
              <button
                type="submit"
                className="cl-btn-primary"
                disabled={isLoading || !chatInput.trim()}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                SEND
              </button>
            </form>
            <div className="cl-suggestions">
              {['Scan my inbox', 'Classify senders', 'Delete job alerts', 'Unsubscribe newsletters'].map(p => (
                <button
                  key={p}
                  className="cl-suggestion"
                  onClick={() => sendMessage({ text: p })}
                  disabled={isLoading}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Scan results ── */}
      {scanResult && (
        <>
          <div className="cl-scan-bar">
            <span className="cl-scan-meta">
              <strong>{scanResult.senders.length}</strong> senders across{' '}
              <strong>{scanResult.totalScanned}</strong> emails
              {doneCount > 0 && <span className="cl-done">✓ {doneCount} cleaned</span>}
            </span>
            <div className="cl-bulk-actions">
              <button
                className="cl-btn-trash"
                disabled={selectedCount === 0}
                onClick={deleteSelected}
              >
                TRASH ({selectedCount})
              </button>
              <button
                className="cl-btn-unsub"
                disabled={selectedCount === 0}
                onClick={unsubscribeAndDeleteSelected}
              >
                UNSUB + TRASH ({selectedCount})
              </button>
            </div>
          </div>

          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>
                    <input
                      type="checkbox"
                      className="cl-checkbox"
                      checked={scanResult.senders.length > 0 && selected.size === scanResult.senders.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Sender</th>
                  <th style={{ width: 80 }}>Emails</th>
                  <th style={{ width: 130 }}>Category</th>
                  <th style={{ width: 90 }}>Unsub</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {scanResult.senders.map(sender => {
                  const st = senderStatuses[sender.email] || 'idle';
                  const busy = st === 'deleting' || st === 'unsubscribing';
                  const cat = sender.category;
                  const catStyle = cat ? CATEGORY_COLORS[cat] : null;
                  return (
                    <tr key={sender.email} className={st === 'done' ? 'cl-row-done' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          className="cl-checkbox"
                          checked={selected.has(sender.email)}
                          onChange={() => toggleSelect(sender.email)}
                          disabled={busy || st === 'done'}
                        />
                      </td>
                      <td>
                        <div className="cl-sender-name">{sender.displayName}</div>
                        <div className="cl-sender-email">{sender.email}</div>
                      </td>
                      <td>
                        <span className="cl-count-badge">{sender.count}</span>
                      </td>
                      <td>
                        {catStyle ? (
                          <span
                            className="cl-cat-badge"
                            style={{ background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.color}40` }}
                          >
                            {cat}
                          </span>
                        ) : (
                          <span className="cl-status-idle">—</span>
                        )}
                      </td>
                      <td>
                        <span className={sender.canAutoUnsubscribe ? 'cl-unsub-auto' : 'cl-unsub-manual'}>
                          {sender.canAutoUnsubscribe ? 'AUTO' : 'MANUAL'}
                        </span>
                      </td>
                      <td>
                        {st === 'idle' && <span className="cl-status-idle">—</span>}
                        {(st === 'unsubscribing' || st === 'deleting') && (
                          <span className="cl-status-working">
                            <div className="cl-thinking-dot" />
                            <div className="cl-thinking-dot" />
                            <div className="cl-thinking-dot" />
                            {st === 'unsubscribing' ? 'UNSUB' : 'TRASH'}
                          </span>
                        )}
                        {st === 'done' && <span className="cl-status-done">✓ DONE</span>}
                        {st === 'error' && <span className="cl-status-error">✕ ERROR</span>}
                      </td>
                      <td>
                        <div className="cl-row-actions">
                          <button
                            className="cl-act-btn cl-act-trash"
                            disabled={busy || st === 'done'}
                            onClick={() => trashSender(sender.email)}
                            title="Move all emails to Trash"
                          >
                            TRASH
                          </button>
                          <button
                            className="cl-act-btn cl-act-unsub"
                            disabled={busy || st === 'done'}
                            onClick={() => unsubAndTrashSender(sender)}
                            title="Unsubscribe then Trash"
                          >
                            +UNSUB
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Action log ── */}
      {actionLog.length > 0 && (
        <div className="cl-log">
          <p className="cl-log-header">// action_log</p>
          <div className="cl-log-body">
            {actionLog.map((line, i) => (
              <div key={i} className="cl-log-line">{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!scanResult && !scanning && (
        <div className="cl-empty">
          <div className="cl-empty-icon">🧹</div>
          <div className="cl-empty-title">Ready to clean</div>
          <p className="cl-empty-sub">
            Hit <strong style={{ color: '#00d97e' }}>SCAN INBOX</strong> to find every
            newsletter, promo, and job alert sender grouped by volume.
          </p>
          <p className="cl-empty-hint">
            Or open the <em>AI Agent</em> and say<br />
            <em>&quot;scan my inbox and delete all job alerts&quot;</em>
          </p>
        </div>
      )}
    </Shell>
  );
}
