'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRouter } from 'next/navigation';

import type { SenderRow, ScanResult, SenderStatus, ScanLine } from './types';
import { PAGE_SIZE, priorityScore } from './utils';

import Shell from './components/Shell';
import ConnectGmail from './components/ConnectGmail';
import ScanTerminal from './components/ScanTerminal';
import ChatPanel from './components/ChatPanel';
import AnalyticsReport from './components/AnalyticsReport';
import SmartSummary from './components/SmartSummary';
import CategoryBulkActions from './components/CategoryBulkActions';
import BulkProgress from './components/BulkProgress';
import SenderTable from './components/SenderTable';
import ConfirmModal from './components/ConfirmModal';
import ActionLog from './components/ActionLog';
import styles from './cleaner.module.css';

export default function CleanerPage() {
  const router = useRouter();

  // ── Auth ─────────────────────────────────────────────────────────
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/auth/status').then(r => r.json()).then(d => setGmailConnected(d.connected));
  }, []);

  // ── Scan state ───────────────────────────────────────────────────
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanLines, setScanLines] = useState<ScanLine[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [summaryDismissed, setSummaryDismissed] = useState(false);

  // ── Table state ──────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [senderStatuses, setSenderStatuses] = useState<Record<string, SenderStatus>>({});
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  // ── Bulk action state ────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<{
    label: string; senders: SenderRow[]; emailCount: number;
  } | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{
    label: string; done: number; total: number;
  } | null>(null);

  // ── Chat state ───────────────────────────────────────────────────
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [pendingAutoAnalyze, setPendingAutoAnalyze] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // ── Custom chat transport — injects scan context at call time ─────
  const scanContextRef = useRef<ScanResult | null>(null);
  useEffect(() => { scanContextRef.current = scanResult; }, [scanResult]);

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/agent/cleaner',
    fetch: async (url, init) => {
      const ctx = scanContextRef.current;
      const existing = JSON.parse((init?.body as string) || '{}');
      return fetch(url as string, {
        ...init,
        body: JSON.stringify({
          ...existing,
          scanContext: ctx ? {
            total: ctx.total,
            senders: ctx.senders.map(s => ({
              displayName: s.displayName,
              email: s.email,
              count: s.count,
              canAutoUnsubscribe: s.canAutoUnsubscribe,
              oldestDate: s.oldestDate,
            })),
          } : null,
        }),
      });
    },
  }), []);

  const { messages, status, sendMessage } = useChat({
    transport,
    onError: err => log(`Agent error: ${err.message}`),
  });

  // Auto-open chat after scan
  useEffect(() => {
    if (pendingAutoAnalyze && scanResult && status === 'ready') {
      setPendingAutoAnalyze(false);
      setShowChat(true);
      sendMessage({ text: 'Analyze my inbox results and give me a brief plan to clean it.' });
    }
  }, [pendingAutoAnalyze, scanResult, status]);

  // ── Helpers ──────────────────────────────────────────────────────
  const log = (msg: string) =>
    setActionLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const setStatus = (email: string, s: SenderStatus) =>
    setSenderStatuses(prev => ({ ...prev, [email]: s }));

  const pushLine = (line: ScanLine) =>
    setScanLines(prev => {
      if (line.type === 'progress' && prev.length > 0 && prev[prev.length - 1].type === 'progress') {
        return [...prev.slice(0, -1), line];
      }
      return [...prev, line];
    });

  // ── Scan ─────────────────────────────────────────────────────────
  const scanInbox = async () => {
    setScanning(true);
    setScanResult(null);
    setScanLines([]);
    setSelected(new Set());
    setSenderStatuses({});
    setActionLog([]);
    setSummaryDismissed(false);

    try {
      const res = await fetch('/api/agent/scan-senders');
      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (['init', 'ids', 'grouping'].includes(evt.phase)) {
              pushLine({ text: evt.message, type: 'info' });
            } else if (evt.phase === 'ids_done') {
              pushLine({ text: evt.message, type: 'info' });
            } else if (evt.phase === 'metadata') {
              pushLine({ text: evt.message, type: 'progress', progress: evt.progress });
            } else if (evt.phase === 'done') {
              pushLine({ text: evt.message, type: 'success' });
              if (evt.result) {
                setScanResult(evt.result);
                setPage(0);
                log(`Scan complete — ${evt.result.senders.length} senders, ${evt.result.total.toLocaleString()} stale emails.`);
                setPendingAutoAnalyze(true);
                classifyAllAfterScan(evt.result.senders);
              }
            } else if (evt.phase === 'error') {
              pushLine({ text: evt.message, type: 'error' });
              log(`Scan error: ${evt.message}`);
            }
          } catch { /* malformed event */ }
        }
      }
    } catch (err: any) {
      pushLine({ text: `Connection error: ${err.message}`, type: 'error' });
      log('Scan failed.');
    } finally {
      setScanning(false);
    }
  };

  // ── Classification ───────────────────────────────────────────────
  const applyClassifications = (classifications: { email: string; category: string }[]) => {
    if (!classifications.length) return;
    setScanResult(prev => {
      if (!prev) return prev;
      const catMap = new Map(classifications.map(c => [c.email, c.category]));
      return {
        ...prev,
        senders: prev.senders.map(s => ({ ...s, category: catMap.get(s.email) || s.category })),
      };
    });
  };

  const classifyAllAfterScan = async (senders: SenderRow[]) => {
    setClassifying(true);
    try {
      const res = await fetch('/api/agent/classify-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senders }),
      });
      const data = await res.json();
      if (data.classifications) applyClassifications(data.classifications);
    } catch { /* best-effort */ } finally {
      setClassifying(false);
    }
  };

  // ── Per-sender actions ───────────────────────────────────────────
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
      setScanResult(prev => {
        if (!prev) return prev;
        const removed = prev.senders.find(s => s.email === email);
        return {
          ...prev,
          senders: prev.senders.filter(s => s.email !== email),
          total: removed ? Math.max(0, prev.total - removed.count) : prev.total,
        };
      });
      setSelected(prev => { const next = new Set(prev); next.delete(email); return next; });
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

  // ── Bulk actions ─────────────────────────────────────────────────
  const deleteSelected = async () => { for (const e of [...selected]) await trashSender(e); };
  const unsubscribeAndDeleteSelected = async () => {
    for (const e of [...selected]) {
      const s = scanResult?.senders.find(x => x.email === e);
      if (s) await unsubAndTrashSender(s);
    }
  };

  const runCategoryClean = async (senders: SenderRow[], label: string) => {
    setConfirmModal(null);
    setBulkProgress({ label, done: 0, total: senders.length });
    for (let i = 0; i < senders.length; i++) {
      const s = senders[i];
      if (s.canAutoUnsubscribe) await unsubAndTrashSender(s);
      else await trashSender(s.email);
      setBulkProgress({ label, done: i + 1, total: senders.length });
    }
    setBulkProgress(null);
  };

  const runUnsubQueue = () => {
    if (!scanResult) return;
    const auto = scanResult.senders.filter(
      s => s.canAutoUnsubscribe && (senderStatuses[s.email] || 'idle') === 'idle'
    );
    if (!auto.length) return;
    setConfirmModal({
      label: `UNSUB + TRASH ALL AUTO (${auto.length} senders)`,
      senders: auto,
      emailCount: auto.reduce((n, s) => n + s.count, 0),
    });
  };

  // ── Derived data ─────────────────────────────────────────────────
  const analytics = scanResult ? (() => {
    const s = scanResult.senders;
    return {
      totalEmails:   s.reduce((sum, x) => sum + x.count, 0),
      autoUnsub:     s.filter(x => x.canAutoUnsubscribe).length,
      highPriority:  s.filter(x => x.count >= 10).length,
      oldest:        s.reduce((min, x) => x.oldestDate < min ? x.oldestDate : min, Date.now()),
      buckets: {
        recent:  s.filter(x => { const m = Math.floor((Date.now() - x.oldestDate) / (1000*60*60*24*30)); return m < 12; }).length,
        old:     s.filter(x => { const m = Math.floor((Date.now() - x.oldestDate) / (1000*60*60*24*30)); return m >= 12 && m < 24; }).length,
        veryOld: s.filter(x => { const m = Math.floor((Date.now() - x.oldestDate) / (1000*60*60*24*30)); return m >= 24; }).length,
      },
    };
  })() : null;

  const categoryGroups = useMemo(() => {
    if (!scanResult) return [];
    const map: Record<string, SenderRow[]> = {};
    for (const s of scanResult.senders) {
      if (!s.category) continue;
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    }
    return Object.entries(map)
      .map(([cat, sds]) => ({ cat, sds, total: sds.reduce((n, s) => n + s.count, 0) }))
      .sort((a, b) => b.total - a.total);
  }, [scanResult]);

  const smartSummary = useMemo(() => {
    if (!scanResult || categoryGroups.length === 0) return null;
    const total = categoryGroups.reduce((n, g) => n + g.total, 0);
    const cleanable = categoryGroups.filter(g => g.cat !== 'transactional').reduce((n, g) => n + g.total, 0);
    return { total, cleanable, topCat: categoryGroups[0], autoCount: scanResult.senders.filter(s => s.canAutoUnsubscribe).length, groups: categoryGroups };
  }, [categoryGroups, scanResult]);

  const sortedSenders = useMemo(() =>
    scanResult ? [...scanResult.senders].sort((a, b) => priorityScore(b) - priorityScore(a)) : [],
  [scanResult]);

  const totalPages = Math.ceil(sortedSenders.length / PAGE_SIZE);
  const pagedSenders = sortedSenders.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const selectedCount = selected.size;
  const doneCount = Object.values(senderStatuses).filter(s => s === 'done').length;
  const autoCount = scanResult?.senders.filter(
    s => s.canAutoUnsubscribe && (senderStatuses[s.email] || 'idle') === 'idle'
  ).length ?? 0;

  // ── Render ───────────────────────────────────────────────────────
  if (gmailConnected === null) {
    return (
      <Shell onDisconnect={() => {}}>
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'60vh' }}>
          <div style={{ textAlign:'center' }}>
            <div className={styles.spinner} />
            <p className={styles.spinnerLabel}>INITIALIZING...</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (!gmailConnected) {
    return (
      <Shell onDisconnect={() => {}}>
        <ConnectGmail />
      </Shell>
    );
  }

  return (
    <Shell onDisconnect={async () => { await fetch('/api/auth/disconnect', { method: 'POST' }); router.push('/'); }}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.pageTag}>// inbox_cleaner</p>
          <h1 className={styles.pageTitle}>Inbox Cleaner</h1>
          <p className={styles.pageSub}>scanning unread emails older than 6 months · repetitive senders only</p>
        </div>
        <div className={styles.headerActions}>
          {autoCount > 0 && (
            <button className={styles.unsubChip} onClick={runUnsubQueue} disabled={!!bulkProgress}>
              ⚡ UNSUB ALL AUTO <span className={styles.catChipCount}>({autoCount})</span>
            </button>
          )}
          <button className={styles.btnOutline} onClick={() => setShowChat(v => !v)}>
            {showChat ? 'HIDE AGENT' : '✦ ASK AI AGENT'}
          </button>
          <button className={styles.btnPrimary} onClick={scanInbox} disabled={scanning}>
            {scanning ? 'SCANNING...' : 'SCAN INBOX'}
          </button>
        </div>
      </div>

      <ScanTerminal scanLines={scanLines} scanning={scanning} classifying={classifying} />

      {showChat && (
        <ChatPanel
          messages={messages}
          status={status}
          chatInput={chatInput}
          setChatInput={setChatInput}
          sendMessage={sendMessage}
          chatBodyRef={chatBodyRef}
          chatInputRef={chatInputRef}
        />
      )}

      {scanResult && analytics && (
        <AnalyticsReport scanResult={scanResult} analytics={analytics} />
      )}

      {smartSummary && !summaryDismissed && !classifying && (
        <SmartSummary summary={smartSummary} onDismiss={() => setSummaryDismissed(true)} />
      )}

      <CategoryBulkActions
        categoryGroups={categoryGroups}
        bulkActive={!!bulkProgress}
        classifying={classifying}
        autoCount={autoCount}
        onCategoryClick={(label, senders, emailCount) => setConfirmModal({ label, senders, emailCount })}
        onUnsubQueue={runUnsubQueue}
      />

      {bulkProgress && <BulkProgress {...bulkProgress} />}

      {scanResult && (
        <SenderTable
          scanResult={scanResult}
          pagedSenders={pagedSenders}
          selected={selected}
          senderStatuses={senderStatuses}
          page={page}
          totalPages={totalPages}
          doneCount={doneCount}
          selectedCount={selectedCount}
          onToggleSelect={email => setSelected(prev => { const n = new Set(prev); n.has(email) ? n.delete(email) : n.add(email); return n; })}
          onToggleSelectAll={() => {
            if (!scanResult) return;
            selected.size === scanResult.senders.length
              ? setSelected(new Set())
              : setSelected(new Set(scanResult.senders.map(s => s.email)));
          }}
          onTrash={trashSender}
          onUnsubTrash={unsubAndTrashSender}
          onDeleteSelected={deleteSelected}
          onUnsubscribeAndDeleteSelected={unsubscribeAndDeleteSelected}
          onPage={setPage}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onConfirm={() => runCategoryClean(confirmModal.senders, confirmModal.label)}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      <ActionLog entries={actionLog} />

      {!scanResult && !scanning && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🗂️</div>
          <div className={styles.emptyTitle}>Ready to scan</div>
          <p className={styles.emptySub}>
            Hit <strong style={{ color: '#00d97e' }}>SCAN INBOX</strong> to find every sender
            with unread emails sitting in your mailbox for more than 6 months.
          </p>
          <p className={styles.emptyHint}>
            Only <em>repetitive senders</em> (2+ emails) are shown —<br />
            newsletters, job alerts, and promos you never opened.
          </p>
        </div>
      )}
    </Shell>
  );
}
