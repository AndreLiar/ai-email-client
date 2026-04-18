'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

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
import { track } from '@/lib/analytics';

type PreviewDecisionAction = 'delete' | 'archive' | 'keep' | 'reply';

interface DecisionPreviewDecision {
  decisionId?: string;
  messageId: string;
  action: PreviewDecisionAction;
  confidence: number;
  reason: string;
}

interface DecisionPreviewData {
  previewId?: string;
  dropped: number;
  summary: {
    delete: number;
    archive: number;
    keep: number;
    reply: number;
  };
  decisions: DecisionPreviewDecision[];
}

interface ExecutionResultData {
  applied: {
    delete: number;
    archive: number;
    keep: number;
    reply: number;
  };
  skipped: number;
  errors: number;
  results?: Array<{
    messageId: string;
    action: PreviewDecisionAction;
    status: 'applied' | 'skipped' | 'error';
    reason?: string;
  }>;
}

interface HistoryRecordData {
  previewId: string;
  selectedDecisionIds: string[];
  result: {
    applied: {
      delete: number;
      archive: number;
      keep: number;
      reply: number;
    };
    skipped: number;
    errors: number;
  };
  executedAt: number;
}

const FREE_APPLY_LIMIT = 50;

export default function CleanerPage() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();

  // ── Auth ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoaded && !userId) {
      router.replace('/sign-in');
    }
  }, [isLoaded, userId, router]);

  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/auth/status').then(r => r.json()).then(d => setGmailConnected(d.connected));
  }, []);
  useEffect(() => {
    if (!gmailConnected) return;
    if (gmailConnectedTrackedRef.current) return;
    gmailConnectedTrackedRef.current = true;
    track('gmail_connected');
  }, [gmailConnected]);

  // ── Scan state ───────────────────────────────────────────────────
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanLines, setScanLines] = useState<ScanLine[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  const [decisionPreview, setDecisionPreview] = useState<DecisionPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedDecisionIds, setSelectedDecisionIds] = useState<Set<string>>(new Set());
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResultData | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('Unlock bulk cleanup to apply all actions in one click');
  const [upgradeRemainingCount, setUpgradeRemainingCount] = useState(0);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecordData[]>([]);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<HistoryRecordData | null>(null);

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
  const autoPreviewTriggeredRef = useRef(false);
  const gmailConnectedTrackedRef = useRef(false);
  const previewTrackedRef = useRef<string | null>(null);
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
    setDecisionPreview(null);
    setPreviewError(null);
    setSelectedDecisionIds(new Set());
    setExecutionResult(null);
    setExecutionError(null);
    setNeedsUpgrade(false);

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

  const getDecisionId = (decision: DecisionPreviewDecision): string =>
    decision.decisionId || decision.messageId;

  const isEligibleDecision = (decision: DecisionPreviewDecision): boolean => {
    if (decision.action === 'delete') return decision.confidence >= 0.9;
    if (decision.action === 'archive') return decision.confidence >= 0.75;
    return false;
  };

  const isBlockedReason = (reason: string): boolean => {
    const normalized = reason.toLowerCase();
    return normalized.includes('guardrail') || normalized.includes('unsafe_reply_recipient') || normalized.includes('blocked');
  };

  const isErrorReason = (reason: string): boolean => {
    const normalized = reason.toLowerCase();
    return normalized.includes('failed') || normalized.includes('error') || normalized.includes('metadata_fetch_failed');
  };

  const getPreviewStatus = (decision: DecisionPreviewDecision): 'selected' | 'selectable' | 'skipped' | 'error' => {
    if (isErrorReason(decision.reason)) return 'error';
    if (isBlockedReason(decision.reason)) return 'skipped';
    return selectedDecisionIds.has(getDecisionId(decision)) ? 'selected' : 'selectable';
  };

  const findExecutionItem = (decision: DecisionPreviewDecision) =>
    executionResult?.results?.find(item => item.messageId === decision.messageId && item.action === decision.action);

  const previewAIDecisions = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setDecisionPreview(null);
    setExecutionResult(null);
    setExecutionError(null);
    try {
      const res = await fetch('/api/agent/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'is:unread older_than:180d',
          limit: 100,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to preview decisions.');

      setDecisionPreview(data);
      const autoSelected = new Set<string>(
        (data.decisions || [])
          .filter((decision: DecisionPreviewDecision) => isEligibleDecision(decision))
          .map((decision: DecisionPreviewDecision) => getDecisionId(decision))
          .filter((id: string): id is string => Boolean(id))
      );
      setSelectedDecisionIds(autoSelected);
      log(`Decision preview ready — ${data.decisions?.length ?? 0} decisions.`);
    } catch (err: any) {
      const message = err?.message || 'Failed to preview decisions.';
      setPreviewError(message);
      setSelectedDecisionIds(new Set());
      log(`Decision preview failed: ${message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded || !userId) return;
    if (!gmailConnected) return;
    if (autoPreviewTriggeredRef.current) return;
    if (decisionPreview || previewLoading || scanning) return;

    autoPreviewTriggeredRef.current = true;
    void previewAIDecisions();
  }, [decisionPreview, gmailConnected, isLoaded, previewLoading, scanning, userId]);

  useEffect(() => {
    if (!decisionPreview) return;
    const previewKey = decisionPreview.previewId ?? '__no_preview_id__';
    if (previewTrackedRef.current === previewKey) return;
    previewTrackedRef.current = previewKey;
    track('preview_generated', { count: decisionPreview.decisions.length });
  }, [decisionPreview]);

  const applySelectedDecisions = async () => {
    if (!decisionPreview?.previewId || selectedDecisionIds.size === 0) return;
    const selected = decisionPreview.decisions.filter(decision =>
      selectedDecisionIds.has(getDecisionId(decision))
    );
    const safeSelectedDecisionIds = selected
      .filter(decision => isEligibleDecision(decision))
      .map(decision => getDecisionId(decision))
      .filter((id: string): id is string => Boolean(id));
    track('apply_safe_clicked', { selectedCount: safeSelectedDecisionIds.length });
    if (safeSelectedDecisionIds.length === 0) {
      setExecutionError('No safe actions selected to apply.');
      return;
    }
    if (safeSelectedDecisionIds.length > FREE_APPLY_LIMIT) {
      setNeedsUpgrade(true);
      setUpgradeMessage('Free plan allows up to 50 emails. Upgrade to clean everything at once.');
      setUpgradeRemainingCount(safeSelectedDecisionIds.length - FREE_APPLY_LIMIT);
      track('upgrade_shown', {
        reason: 'quota',
        remaining: safeSelectedDecisionIds.length - FREE_APPLY_LIMIT,
      });
      return;
    }

    setExecutionLoading(true);
    setExecutionError(null);
    setExecutionResult(null);
    setNeedsUpgrade(false);
    setUpgradeRemainingCount(0);
    setUpgradeMessage('Unlock bulk cleanup to apply all actions in one click');
    try {
      const res = await fetch('/api/agent/execute-decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previewId: decisionPreview.previewId,
          selectedDecisionIds: safeSelectedDecisionIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          setNeedsUpgrade(true);
          setUpgradeMessage('Unlock bulk cleanup to apply all actions in one click');
          setUpgradeRemainingCount(Math.max(0, safeSelectedDecisionIds.length - FREE_APPLY_LIMIT));
          track('upgrade_shown', {
            reason: '403',
            remaining: Math.max(0, safeSelectedDecisionIds.length - FREE_APPLY_LIMIT),
          });
          return;
        }
        throw new Error(data?.error || 'Failed to execute decisions.');
      }
      setExecutionResult(data);
      setSelectedDecisionIds(new Set());
      const cleanedCount =
        (data?.applied?.delete ?? 0) +
        (data?.applied?.archive ?? 0) +
        (data?.applied?.keep ?? 0) +
        (data?.applied?.reply ?? 0);
      track('apply_success', { cleanedCount });
      log('Decision execution completed.');
    } catch (err: any) {
      const message = err?.message || 'Failed to execute decisions.';
      setExecutionError(message);
      log(`Decision execution failed: ${message}`);
    } finally {
      setExecutionLoading(false);
    }
  };

  const startCheckoutUpgrade = async () => {
    track('upgrade_clicked');
    setUpgradeLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Failed to start checkout.');
      }
      window.location.href = data.url;
    } catch (err: any) {
      setExecutionError(err?.message || 'Failed to start checkout.');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const viewHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch('/api/agent/history');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch history.');
      const records: HistoryRecordData[] = data.records || [];
      setHistoryRecords(records);
      setSelectedHistoryRecord(records[0] || null);
      log(`Loaded history (${records.length} execution records).`);
    } catch (err: any) {
      const message = err?.message || 'Failed to fetch history.';
      setHistoryError(message);
      log(`History load failed: ${message}`);
    } finally {
      setHistoryLoading(false);
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
  const cleanedCount = executionResult
    ? executionResult.applied.delete + executionResult.applied.archive
    : 0;
  const safeNowCount = decisionPreview
    ? decisionPreview.decisions.filter(decision => isEligibleDecision(decision)).length
    : 0;

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
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.2)', background: !gmailConnected ? 'rgba(255,255,255,0.12)' : 'transparent' }}>
          1. Connect Gmail
        </span>
        <span style={{ fontSize: 13, padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.2)', background: gmailConnected && decisionPreview && !executionResult ? 'rgba(255,255,255,0.12)' : 'transparent' }}>
          2. Preview
        </span>
        <span style={{ fontSize: 13, padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.2)', background: executionResult ? 'rgba(74,222,128,0.2)' : 'transparent' }}>
          3. Apply
        </span>
      </div>

      {executionResult && (
        <div style={{ marginBottom: 12, color: '#4ade80', fontSize: 14, border: '1px solid rgba(74,222,128,0.5)', borderRadius: 8, padding: 10 }}>
          Done! Cleaned {cleanedCount} emails
        </div>
      )}

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
          <button className={styles.btnOutline} onClick={previewAIDecisions} disabled={previewLoading || scanning}>
            {previewLoading ? 'GENERATING...' : 'Generate My Cleanup Plan'}
          </button>
          <button className={styles.btnOutline} onClick={viewHistory} disabled={historyLoading}>
            {historyLoading ? 'LOADING HISTORY...' : 'View History'}
          </button>
          <button className={styles.btnPrimary} onClick={scanInbox} disabled={scanning}>
            {scanning ? 'SCANNING...' : 'SCAN INBOX'}
          </button>
        </div>
      </div>

      <ScanTerminal scanLines={scanLines} scanning={scanning} classifying={classifying} />

      {previewLoading && (
        <div style={{ marginTop: 12, fontSize: 14, opacity: 0.9 }}>
          <p style={{ margin: 0 }}>Analyzing your inbox...</p>
          <p style={{ margin: '4px 0 0 0' }}>Grouping senders and finding safe actions...</p>
        </div>
      )}

      {previewError && (
        <div style={{ marginTop: 12, color: '#ff6b6b', fontSize: 14 }}>
          Decision preview error: {previewError}
        </div>
      )}

      {decisionPreview && (
        <div style={{ marginTop: 16, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: 12 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>AI Decision Preview</h3>
          {decisionPreview.previewId && (
            <p style={{ margin: '0 0 8px 0', fontSize: 12, opacity: 0.8 }}>Preview ID: {decisionPreview.previewId}</p>
          )}
          <div style={{ marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              Your inbox can be cleaned in seconds
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: 14, opacity: 0.9 }}>
              We found {safeNowCount} emails you can safely clean right now
            </p>
          </div>
          <div style={{ marginBottom: 10, padding: 10, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 14 }}>
              Total decisions: {decisionPreview.decisions.length}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: 14 }}>
              Delete: {decisionPreview.summary.delete} · Archive: {decisionPreview.summary.archive} · Keep: {decisionPreview.summary.keep} · Reply: {decisionPreview.summary.reply}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <button
              className={styles.btnPrimary}
              onClick={applySelectedDecisions}
              disabled={!decisionPreview.previewId || selectedDecisionIds.size === 0 || executionLoading}
            >
              {executionLoading ? 'APPLYING...' : 'Apply Safe Actions'}
            </button>
            <button
              className={styles.btnOutline}
              onClick={() => {
                const eligible = new Set<string>(
                  decisionPreview.decisions
                    .filter(d => isEligibleDecision(d))
                    .map(d => getDecisionId(d))
                    .filter((id: string): id is string => Boolean(id))
                );
                setSelectedDecisionIds(eligible);
              }}
            >
              Select all eligible
            </button>
            <button className={styles.btnOutline} onClick={() => setSelectedDecisionIds(new Set())}>
              Clear selection
            </button>
            <span style={{ alignSelf: 'center', fontSize: 13 }}>
              Selected: {selectedDecisionIds.size}
            </span>
          </div>
          <div style={{ marginBottom: 8, fontSize: 13, opacity: 0.9 }}>
            <p style={{ margin: 0 }}>Nothing is deleted without your approval</p>
            <p style={{ margin: '4px 0 0 0' }}>You can review every action before applying</p>
          </div>
          {needsUpgrade && (
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700 }}>
                Finish cleaning your inbox
              </p>
              <p style={{ margin: '0 0 8px 0', fontSize: 14 }}>
                You've already cleaned part of your inbox. Upgrade to apply all remaining actions in one click.
              </p>
              <button
                className={styles.btnPrimary}
                onClick={startCheckoutUpgrade}
                disabled={upgradeLoading}
              >
                {upgradeLoading ? 'REDIRECTING...' : 'Upgrade to clean everything'}
              </button>
            </div>
          )}
          {decisionPreview.dropped > 0 && (
            <p style={{ margin: '0 0 8px 0', fontSize: 14, color: '#ffb86c' }}>
              Dropped: {decisionPreview.dropped}
            </p>
          )}
          {decisionPreview.decisions.length === 0 ? (
            <div style={{ marginTop: 10, fontSize: 14 }}>
              <p style={{ margin: 0 }}>Your inbox is already clean 🎉</p>
              <p style={{ margin: '4px 0 0 0', opacity: 0.9 }}>
                We'll notify you when new cleanup opportunities appear
              </p>
            </div>
          ) : (() => {
            const eligible = decisionPreview.decisions.filter(d => !isBlockedReason(d.reason) && !isErrorReason(d.reason));
            const blocked = decisionPreview.decisions.filter(d => isBlockedReason(d.reason));
            const errors = decisionPreview.decisions.filter(d => isErrorReason(d.reason));

            const renderDecision = (decision: DecisionPreviewDecision, allowSelect: boolean) => {
              const status = getPreviewStatus(decision);
              const executionItem = findExecutionItem(decision);
              return (
                <li key={decision.decisionId || decision.messageId} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    {allowSelect ? (
                      <input
                        type="checkbox"
                        checked={selectedDecisionIds.has(getDecisionId(decision))}
                        onChange={e => {
                          const id = getDecisionId(decision);
                          setSelectedDecisionIds(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(id);
                            else next.delete(id);
                            return next;
                          });
                        }}
                      />
                    ) : (
                      <span style={{ width: 14 }} />
                    )}
                    <div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, padding: '2px 6px', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 999 }}>
                          {decision.action}
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 6px', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 999 }}>
                          {status}
                        </span>
                        {decision.action === 'delete' && (
                          <span style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #ffb86c', borderRadius: 999, color: '#ffb86c' }}>
                            warning
                          </span>
                        )}
                        <span style={{ fontSize: 12, opacity: 0.85 }}>conf {(decision.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        {status === 'skipped' ? `Blocked: ${decision.reason}` : status === 'error' ? `Error: ${decision.reason}` : `Reason: ${decision.reason}`}
                      </div>
                      {executionItem && (
                        <div style={{ fontSize: 12, marginTop: 2, opacity: 0.9 }}>
                          Execution: {executionItem.status}{executionItem.reason ? ` (${executionItem.reason})` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            };

            return (
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ fontSize: 13 }}>Eligible ({eligible.length})</strong>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: 0, listStyle: 'none' }}>
                    {eligible.map(d => renderDecision(d, true))}
                  </ul>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ fontSize: 13 }}>Blocked ({blocked.length})</strong>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: 0, listStyle: 'none' }}>
                    {blocked.map(d => renderDecision(d, false))}
                  </ul>
                </div>
                <div>
                  <strong style={{ fontSize: 13 }}>Errors ({errors.length})</strong>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: 0, listStyle: 'none' }}>
                    {errors.map(d => renderDecision(d, false))}
                  </ul>
                </div>
              </div>
            );
          })()}
          {executionError && (
            <p style={{ margin: '10px 0 0 0', color: '#ff6b6b', fontSize: 14 }}>
              Execution error: {executionError}
            </p>
          )}
          {executionResult && (
            <p style={{ margin: '10px 0 0 0', fontSize: 14 }}>
              Execution summary: applied {executionResult.applied.delete + executionResult.applied.archive + executionResult.applied.keep + executionResult.applied.reply}
              {' '}· skipped {executionResult.skipped} · errors {executionResult.errors}
            </p>
          )}
        </div>
      )}

      {(historyError || historyRecords.length > 0) && (
        <div style={{ marginTop: 16, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: 12 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Execution History</h3>
          {historyError && (
            <p style={{ margin: '0 0 8px 0', color: '#ff6b6b', fontSize: 14 }}>
              History error: {historyError}
            </p>
          )}
          <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 180, overflowY: 'auto' }}>
            {historyRecords.map(record => {
              const appliedTotal =
                record.result.applied.delete +
                record.result.applied.archive +
                record.result.applied.keep +
                record.result.applied.reply;
              return (
                <li key={`${record.previewId}-${record.executedAt}`} style={{ marginBottom: 8 }}>
                  <button
                    className={styles.btnOutline}
                    style={{ width: '100%', textAlign: 'left' }}
                    onClick={() => setSelectedHistoryRecord(record)}
                  >
                    {record.previewId} · {new Date(record.executedAt).toLocaleString()} · applied {appliedTotal} · skipped {record.result.skipped} · errors {record.result.errors}
                  </button>
                </li>
              );
            })}
          </ul>
          {selectedHistoryRecord && (
            <div style={{ marginTop: 10, fontSize: 13 }}>
              <p style={{ margin: '0 0 6px 0' }}>
                <strong>Details</strong> · previewId: {selectedHistoryRecord.previewId}
              </p>
              <p style={{ margin: '0 0 6px 0' }}>
                Result: applied {selectedHistoryRecord.result.applied.delete + selectedHistoryRecord.result.applied.archive + selectedHistoryRecord.result.applied.keep + selectedHistoryRecord.result.applied.reply}
                {' '}· skipped {selectedHistoryRecord.result.skipped} · errors {selectedHistoryRecord.result.errors}
              </p>
              <p style={{ margin: 0 }}>
                selectedDecisionIds: {selectedHistoryRecord.selectedDecisionIds.join(', ') || '(none)'}
              </p>
            </div>
          )}
        </div>
      )}

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
