// src/app/cleaner/page.tsx
'use client';

import ProtectedLayout from '@/components/layouts/ProtectedLayout';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

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

const CATEGORY_BADGES: Record<string, string> = {
  newsletter: 'bg-info text-dark',
  job_alert: 'bg-warning text-dark',
  promo: 'bg-danger',
  social: 'bg-primary',
  transactional: 'bg-success',
  other: 'bg-secondary',
};

export default function CleanerPage() {
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

  // Auto-scroll chat
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
      log(`Scanned ${data.totalScanned} emails, found ${data.senders.length} unique senders.`);
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
    if (selected.size === scanResult.senders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(scanResult.senders.map(s => s.email)));
    }
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
      log(`Trashed ${data.deleted} email(s) from ${email}`);
    } catch {
      setStatus(email, 'error');
      log(`Failed to delete emails from ${email}`);
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
      if (data.method === 'one-click-post') log(`Unsubscribed from ${sender.email} (one-click)`);
      else if (data.method === 'mailto') log(`Sent unsubscribe email to ${data.to}`);
      else if (data.method === 'link') log(`Manual unsubscribe needed: ${data.url}`);
      else log(`No unsubscribe option for ${sender.email}`);
    } catch {
      log(`Unsubscribe request failed for ${sender.email}`);
    }
    await trashSender(sender.email);
  };

  const deleteSelected = async () => {
    for (const email of [...selected]) await trashSender(email);
  };

  const unsubscribeAndDeleteSelected = async () => {
    for (const email of [...selected]) {
      const sender = scanResult?.senders.find(s => s.email === email);
      if (sender) await unsubAndTrashSender(sender);
    }
  };

  // Helper to extract text from v6 UIMessage parts
  const getMessageText = (message: (typeof messages)[0]) => {
    return message.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('');
  };

  const selectedCount = selected.size;
  const doneCount = Object.values(senderStatuses).filter(s => s === 'done').length;

  if (gmailConnected === null) {
    return (
      <ProtectedLayout>
        <div className="text-center mt-5 text-muted">
          <span className="spinner-border" />
        </div>
      </ProtectedLayout>
    );
  }

  if (!gmailConnected) {
    return (
      <ProtectedLayout>
        <div className="text-center mt-5">
          <div style={{ fontSize: '3rem' }}>📬</div>
          <h3 className="mt-3">Connect your Gmail</h3>
          <p className="text-muted">
            Grant access to your Gmail account so the AI agent can scan and clean your inbox.
          </p>
          <a href="/api/auth/gmail-connect" className="btn btn-danger btn-lg mt-2">
            Connect Gmail
          </a>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="mb-0">Inbox Cleaner</h1>
          <small className="text-muted">Unsubscribe and bulk-delete email senders</small>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setShowChat(v => !v)}
          >
            {showChat ? 'Hide Agent Chat' : 'Ask AI Agent'}
          </button>
          <button className="btn btn-primary" onClick={scanInbox} disabled={scanning}>
            {scanning ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Scanning...
              </>
            ) : (
              'Scan Inbox'
            )}
          </button>
        </div>
      </div>

      {/* ── AI Agent Chat Panel ── */}
      {showChat && (
        <div className="card mb-4 border-primary">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <strong>AI Agent (Gemini 1.5 Flash)</strong>
            <small className="opacity-75">Vercel AI SDK v6 · streaming</small>
          </div>
          <div
            className="card-body p-3"
            style={{ height: 300, overflowY: 'auto', background: '#f8f9fa' }}
          >
            {messages.length === 0 && (
              <p className="text-muted text-center mt-5">
                Ask the agent to scan, classify, or clean your inbox.
              </p>
            )}
            {messages.map(m => {
              const text = getMessageText(m);
              if (!text) return null;
              return (
                <div
                  key={m.id}
                  className={`mb-3 d-flex ${m.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
                >
                  <div style={{ maxWidth: '85%' }}>
                    <span
                      className={`badge mb-1 ${m.role === 'user' ? 'bg-primary' : 'bg-secondary'}`}
                    >
                      {m.role === 'user' ? 'You' : 'Agent'}
                    </span>
                    <div
                      className="p-2 rounded"
                      style={{
                        background: m.role === 'user' ? '#cfe2ff' : '#fff',
                        fontSize: '0.875rem',
                        border: '1px solid #dee2e6',
                      }}
                    >
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="text-muted small">
                <span className="spinner-border spinner-border-sm me-1" />
                Agent is working...
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
          <div className="card-footer p-2">
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!chatInput.trim() || isLoading) return;
                sendMessage({ text: chatInput });
                setChatInput('');
              }}
              className="d-flex gap-2 mb-2"
            >
              <input
                className="form-control form-control-sm"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder='e.g. "Scan my inbox" or "Delete all job alerts"'
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isLoading || !chatInput.trim()}
              >
                Send
              </button>
            </form>
            <div className="d-flex gap-1 flex-wrap">
              {[
                'Scan my inbox',
                'Classify the senders',
                'Delete all job alerts',
                'Unsubscribe from all newsletters',
              ].map(prompt => (
                <button
                  key={prompt}
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => sendMessage({ text: prompt })}
                  disabled={isLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Scan Results Table ── */}
      {scanResult && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="text-muted small">
              {scanResult.totalScanned} emails scanned &mdash;{' '}
              <strong>{scanResult.senders.length} unique senders</strong>
              {doneCount > 0 && (
                <span className="text-success ms-2">({doneCount} cleaned)</span>
              )}
            </span>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-danger btn-sm"
                disabled={selectedCount === 0}
                onClick={deleteSelected}
              >
                Trash selected ({selectedCount})
              </button>
              <button
                className="btn btn-danger btn-sm"
                disabled={selectedCount === 0}
                onClick={unsubscribeAndDeleteSelected}
              >
                Unsubscribe + Trash ({selectedCount})
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={
                        scanResult.senders.length > 0 &&
                        selected.size === scanResult.senders.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Sender</th>
                  <th style={{ width: 70 }}>Emails</th>
                  <th style={{ width: 120 }}>Category</th>
                  <th style={{ width: 90 }}>Unsub</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {scanResult.senders.map(sender => {
                  const st = senderStatuses[sender.email] || 'idle';
                  const busy = st === 'deleting' || st === 'unsubscribing';
                  return (
                    <tr key={sender.email} className={st === 'done' ? 'table-success' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selected.has(sender.email)}
                          onChange={() => toggleSelect(sender.email)}
                          disabled={busy || st === 'done'}
                        />
                      </td>
                      <td>
                        <div className="fw-semibold" style={{ fontSize: '0.875rem' }}>
                          {sender.displayName}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {sender.email}
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-secondary">{sender.count}</span>
                      </td>
                      <td>
                        {sender.category ? (
                          <span
                            className={`badge ${CATEGORY_BADGES[sender.category] || 'bg-secondary'}`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {sender.category}
                          </span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${sender.canAutoUnsubscribe ? 'bg-success' : 'bg-warning text-dark'}`}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {sender.canAutoUnsubscribe ? 'Auto' : 'Manual'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {st === 'idle' && <span className="text-muted">—</span>}
                        {st === 'unsubscribing' && (
                          <span className="text-info">
                            <span className="spinner-border spinner-border-sm me-1" />
                            Unsubscribing
                          </span>
                        )}
                        {st === 'deleting' && (
                          <span className="text-warning">
                            <span className="spinner-border spinner-border-sm me-1" />
                            Deleting
                          </span>
                        )}
                        {st === 'done' && <span className="text-success fw-bold">Done</span>}
                        {st === 'error' && <span className="text-danger">Error</span>}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <button
                            className="btn btn-outline-danger btn-sm py-0 px-1"
                            style={{ fontSize: '0.7rem' }}
                            title="Move all emails to Trash"
                            disabled={busy || st === 'done'}
                            onClick={() => trashSender(sender.email)}
                          >
                            Trash
                          </button>
                          <button
                            className="btn btn-outline-dark btn-sm py-0 px-1"
                            style={{ fontSize: '0.7rem' }}
                            title="Unsubscribe then Trash"
                            disabled={busy || st === 'done'}
                            onClick={() => unsubAndTrashSender(sender)}
                          >
                            +Unsub
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

      {/* ── Action Log ── */}
      {actionLog.length > 0 && (
        <div className="mt-4">
          <h6 className="text-muted small text-uppercase">Action Log</h6>
          <div
            className="bg-dark text-success p-3 rounded"
            style={{
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {actionLog.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!scanResult && !scanning && (
        <div className="text-center mt-5 text-muted">
          <div style={{ fontSize: '3rem' }}>🧹</div>
          <h4>Clean Your Inbox</h4>
          <p>
            Click <strong>Scan Inbox</strong> to find newsletters, job alerts, and promo senders.
          </p>
          <p className="small">
            Or open the <strong>AI Agent</strong> and say{' '}
            <em>&quot;Scan my inbox and delete all job alerts&quot;</em>
          </p>
        </div>
      )}
    </ProtectedLayout>
  );
}
