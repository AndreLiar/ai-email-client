'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

import type { SenderRow, ScanResult, SenderStatus, ScanLine } from './types';
import { PAGE_SIZE, priorityScore } from './utils';

import Shell from './components/Shell';
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
    if (!userId) return;
    setGmailConnected(null);
    setScanResult(null);
    setDecisionPreview(null);
    setExecutionResult(null);
    setSelectedDecisionIds(new Set());
    fetch('/api/auth/status')
      .then(r => r.ok ? r.json() : { connected: false, subscribed: false })
      .then(d => { setGmailConnected(d.connected); setIsSubscribed(d.subscribed ?? false); })
      .catch(() => setGmailConnected(false));
  }, [userId]);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [applyConfirmData, setApplyConfirmData] = useState<{
    deleteCount: number; archiveCount: number; total: number; safeIds: string[];
  } | null>(null);
  const [paymentCheckAgain, setPaymentCheckAgain] = useState(false);

  const checkSubscriptionNow = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = res.ok ? await res.json() : {};
      if (data.subscribed) {
        setIsSubscribed(true);
        setPaymentPending(false);
        setPaymentCheckAgain(false);
        setNeedsUpgrade(false);
      }
    } catch { /* silent */ }
  };

  // Check subscription after Stripe redirect — immediate + exponential backoff
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('success') !== 'true') return;
    setPaymentPending(true);
    router.replace('/cleaner', { scroll: false });
    // Delays between retries: immediate, +3s, +5s, +12s, +15s (total ~35s max)
    const gaps = [0, 3000, 5000, 12000, 15000];
    let cancelled = false;
    let attempt = 0;
    const doCheck = async () => {
      if (cancelled) return;
      try {
        const res = await fetch('/api/auth/status');
        const data = res.ok ? await res.json() : {};
        if (data.subscribed) {
          setIsSubscribed(true);
          setPaymentPending(false);
          setPaymentCheckAgain(false);
          setNeedsUpgrade(false);
          return;
        }
      } catch { /* ignore */ }
      attempt++;
      if (attempt < gaps.length) {
        setTimeout(doCheck, gaps[attempt]);
      } else {
        setPaymentPending(false);
        setPaymentCheckAgain(true);
      }
    };
    doCheck();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Show welcome modal on first sign-in
  useEffect(() => {
    if (!isLoaded || !userId) return;
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('cleaninbox_welcomed')) {
      setShowWelcome(true);
      localStorage.setItem('cleaninbox_welcomed', '1');
    }
  }, [isLoaded, userId]);

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
  const [classifyError, setClassifyError] = useState(false);
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
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
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
  const renderError = (msg: string) => {
    const isReconnect = msg.includes('RECONNECT_REQUIRED') || msg.includes('Gmail not connected') || msg.includes('token expired');
    const isTimeout = msg.includes('timeout') || msg.includes('AbortError') || msg.includes('Failed to fetch');
    const isAI = msg.includes('Failed to generate') || msg.includes('Invalid decision') || msg.includes('AI');
    if (isReconnect) return (
      <span>Gmail connection lost. <a href="/api/auth/gmail-connect" style={{ color: '#00d97e', textDecoration: 'underline' }}>Reconnect Gmail →</a></span>
    );
    if (isTimeout || isAI) return (
      <span>AI service timed out. <button style={{ background: 'none', border: 'none', color: '#00d97e', textDecoration: 'underline', cursor: 'pointer', padding: 0 }} onClick={previewAIDecisions}>Try again →</button></span>
    );
    return <span>{msg}</span>;
  };

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
              if (evt.reconnect) setGmailConnected(false);
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
    if (isBlockedReason(decision.reason) || isErrorReason(decision.reason)) return false;
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
      if (!res.ok) {
        if (data?.reconnect) setGmailConnected(false);
        throw new Error(data?.error || 'Failed to preview decisions.');
      }

      setDecisionPreview(data);
      const autoSelected = new Set<string>(
        (data.decisions || [])
          .filter((decision: DecisionPreviewDecision) => isEligibleDecision(decision))
          .map((decision: DecisionPreviewDecision) => getDecisionId(decision))
          .filter((id: string): id is string => Boolean(id))
      );
      setSelectedDecisionIds(autoSelected);
      log(`Decision preview ready — ${data.decisions?.length ?? 0} decisions, ${autoSelected.size} auto-selected.`);
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

  // Step 1: check paywall + open confirm modal (P0 #2 & #3)
  const requestApply = () => {
    if (executionLoading) return;
    if (!decisionPreview?.previewId || selectedDecisionIds.size === 0) return;
    const eligibleDecisions = decisionPreview.decisions.filter(d =>
      selectedDecisionIds.has(getDecisionId(d)) && isEligibleDecision(d)
    );
    const safeIds = eligibleDecisions
      .map(d => getDecisionId(d))
      .filter((id): id is string => Boolean(id));
    track('apply_safe_clicked', { selectedCount: safeIds.length });
    if (safeIds.length === 0) { setExecutionError('No safe actions selected to apply.'); return; }

    // Paywall check BEFORE confirm modal (P0 #3)
    if (safeIds.length > FREE_APPLY_LIMIT && !isSubscribed) {
      setNeedsUpgrade(true);
      setUpgradeMessage('Free plan allows up to 50 actions. Upgrade to clean everything at once.');
      setUpgradeRemainingCount(safeIds.length - FREE_APPLY_LIMIT);
      track('upgrade_shown', { reason: 'quota', remaining: safeIds.length - FREE_APPLY_LIMIT });
      return;
    }

    // Show confirm modal (P0 #2)
    setApplyConfirmData({
      deleteCount: eligibleDecisions.filter(d => d.action === 'delete').length,
      archiveCount: eligibleDecisions.filter(d => d.action === 'archive').length,
      total: safeIds.length,
      safeIds,
    });
  };

  // Step 2: user confirmed — execute
  const executeApproved = async () => {
    if (!applyConfirmData || !decisionPreview?.previewId) return;
    const { safeIds } = applyConfirmData;
    setApplyConfirmData(null);
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
        body: JSON.stringify({ previewId: decisionPreview.previewId, selectedDecisionIds: safeIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.reconnect) { setGmailConnected(false); return; }
        if (res.status === 403) {
          setNeedsUpgrade(true);
          setUpgradeMessage('Unlock bulk cleanup to apply all actions in one click');
          setUpgradeRemainingCount(Math.max(0, safeIds.length - FREE_APPLY_LIMIT));
          track('upgrade_shown', { reason: '403', remaining: Math.max(0, safeIds.length - FREE_APPLY_LIMIT) });
          return;
        }
        throw new Error(data?.error || 'Failed to execute decisions.');
      }
      setExecutionResult(data);
      setSelectedDecisionIds(new Set());
      const cleanedCount = (data?.applied?.delete ?? 0) + (data?.applied?.archive ?? 0) +
        (data?.applied?.keep ?? 0) + (data?.applied?.reply ?? 0);
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
    setUpgradeError(null);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = res.headers.get('content-type')?.includes('json') ? await res.json() : {};
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Failed to start checkout.');
      }
      window.location.href = data.url;
    } catch (err: any) {
      setUpgradeError(err?.message || 'Failed to start checkout.');
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
    setClassifyError(false);
    try {
      const res = await fetch('/api/agent/classify-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senders }),
      });
      if (!res.ok) { setClassifyError(true); return; }
      const data = await res.json();
      if (data.classifications) applyClassifications(data.classifications);
    } catch { setClassifyError(true); } finally {
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
      if (!res.ok) {
        log(`✕ [unsub] Failed for ${sender.email} — emails will still be deleted`);
      } else {
        const data = await res.json();
        if (data.method === 'one-click-post') log(`✓ [unsub] ${sender.email} — one-click unsubscribe sent`);
        else if (data.method === 'mailto') log(`✓ [unsub] ${sender.email} — unsubscribe email sent to ${data.to}`);
        else if (data.method === 'link') log(`⚠ [unsub] ${sender.email} — manual step required: ${data.url}`);
        else log(`— [unsub] ${sender.email} — no unsubscribe link found, deleting emails only`);
      }
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
    let errorCount = 0;
    for (let i = 0; i < senders.length; i++) {
      const s = senders[i];
      try {
        if (s.canAutoUnsubscribe) await unsubAndTrashSender(s);
        else await trashSender(s.email);
      } catch {
        errorCount++;
        log(`✕ Failed to process ${s.email}`);
      }
      setBulkProgress({ label, done: i + 1, total: senders.length });
    }
    setBulkProgress(null);
    if (errorCount > 0) {
      log(`Bulk clean finished — ${senders.length - errorCount} succeeded, ${errorCount} failed.`);
    } else {
      log(`Bulk clean finished — ${senders.length} sender(s) processed.`);
    }
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
      <Shell onDisconnect={() => {}} gmailConnected={false}>
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'60vh' }}>
          <div style={{ textAlign:'center' }}>
            <div className={styles.spinner} />
            <p className={styles.spinnerLabel}>CHECKING GMAIL CONNECTION...</p>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell gmailConnected={gmailConnected ?? false} onDisconnect={async () => { await fetch('/api/auth/disconnect', { method: 'POST' }); router.push('/'); }}>
      {/* ── Progress Steps (P1 #4) ─────────────────────────────── */}
      {(() => {
        const step = !gmailConnected ? 1 : !executionResult ? 2 : 3;
        const steps = [
          { n: 1, label: 'Connect Gmail' },
          { n: 2, label: 'Preview & Select' },
          { n: 3, label: 'Clean' },
        ];
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20, maxWidth: 480 }}>
            {steps.map((s, i) => {
              const done = s.n < step;
              const active = s.n === step;
              return (
                <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: s.n < steps.length ? 1 : 'unset' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontFamily: 'var(--font-space-mono)', fontWeight: 700,
                      background: done ? '#00d97e' : active ? 'rgba(0,217,126,0.2)' : 'rgba(255,255,255,0.05)',
                      border: active ? '2px solid #00d97e' : done ? 'none' : '1px solid rgba(255,255,255,0.2)',
                      color: done ? '#06090f' : active ? '#00d97e' : 'rgba(255,255,255,0.4)',
                    }}>
                      {done ? '✓' : s.n}
                    </div>
                    <span style={{ fontSize: 10, letterSpacing: '0.08em', color: active ? '#00d97e' : done ? '#c8d8cc' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ flex: 1, height: 1, background: done ? '#00d97e' : 'rgba(255,255,255,0.12)', margin: '0 8px', marginBottom: 20 }} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {!gmailConnected && (
        <div style={{ marginBottom: 20, padding: '20px 24px', border: '1px solid rgba(0,217,126,0.35)', borderRadius: 8, background: 'rgba(0,217,126,0.05)' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: 11, letterSpacing: '0.15em', color: '#00d97e', fontFamily: 'var(--font-space-mono)' }}>// step_01 — gmail_access</p>
          <h2 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700 }}>Connect your Gmail inbox</h2>
          <p style={{ margin: '0 0 6px 0', fontSize: 14, opacity: 0.85, maxWidth: 520 }}>
            We need a second permission to <strong>read and manage your emails</strong>. This is separate from your account login — your login just identifies you, but inbox access requires explicit Gmail authorization.
          </p>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, opacity: 0.6, maxWidth: 520 }}>
            We only access emails to scan, unsubscribe, and delete on your behalf. Your credentials are never stored or shared.
          </p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/api/auth/gmail-connect" className={styles.btnPrimary} style={{ textDecoration: 'none' }}>
              CONNECT GMAIL →
            </a>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, opacity: 0.6 }}>✓ Read &amp; modify emails (scan, delete, unsubscribe)</span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>✓ Tokens stored securely, never shared</span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>✓ Revoke access anytime from your Google account</span>
            </div>
          </div>
        </div>
      )}

      {executionResult && (
        <div style={{ marginBottom: 20, padding: '24px 28px', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 10, background: 'rgba(74,222,128,0.05)', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
          <h2 style={{ margin: '0 0 6px 0', fontSize: 22, fontWeight: 700, color: '#4ade80' }}>Inbox cleaned!</h2>
          <p style={{ margin: '0 0 4px 0', fontSize: 15 }}>
            Deleted <strong>{executionResult.applied.delete}</strong> · Archived <strong>{executionResult.applied.archive}</strong>
            {executionResult.skipped > 0 && <span style={{ opacity: 0.7 }}> · Skipped {executionResult.skipped}</span>}
          </p>
          <p style={{ margin: '0 0 20px 0', fontSize: 13, opacity: 0.65 }}>
            {cleanedCount} email{cleanedCount !== 1 ? 's' : ''} removed from your inbox
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className={styles.btnPrimary} onClick={() => {
              setExecutionResult(null);
              setDecisionPreview(null);
              setSelectedDecisionIds(new Set());
              autoPreviewTriggeredRef.current = false;
              void previewAIDecisions();
            }}>
              SCAN AGAIN
            </button>
            <button className={styles.btnOutline} onClick={() => setExecutionResult(null)}>
              VIEW DETAILS
            </button>
          </div>
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
          <button className={styles.btnOutline} onClick={previewAIDecisions} disabled={!gmailConnected || previewLoading || scanning}>
            {previewLoading ? 'GENERATING...' : 'Generate My Cleanup Plan'}
          </button>
          <button className={styles.btnOutline} onClick={viewHistory} disabled={!gmailConnected || historyLoading}>
            {historyLoading ? 'LOADING HISTORY...' : 'View History'}
          </button>
          <button className={styles.btnPrimary} onClick={scanInbox} disabled={!gmailConnected || scanning}>
            {scanning ? 'SCANNING...' : 'SCAN INBOX'}
          </button>
        </div>
      </div>

      <ScanTerminal scanLines={scanLines} scanning={scanning} classifying={classifying} />

      {classifyError && (
        <div style={{ marginTop: 8, color: '#ffb86c', fontSize: 13 }}>
          ⚠️ Sender classification failed — categories may be incomplete.
        </div>
      )}

      {previewLoading && (
        <div style={{ marginTop: 12, fontSize: 14, opacity: 0.9 }}>
          <p style={{ margin: 0 }}>Analyzing your inbox...</p>
          <p style={{ margin: '4px 0 0 0' }}>Grouping senders and finding safe actions...</p>
        </div>
      )}

      {previewError && (
        <div style={{ marginTop: 12, color: '#ff6b6b', fontSize: 14, padding: '10px 14px', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 6 }}>
          {renderError(previewError)}
        </div>
      )}

      {decisionPreview && (
        <div style={{ marginTop: 16, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>AI Decision Preview</h3>
            {!isSubscribed && (
              <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 999, background: 'rgba(255,184,28,0.12)', border: '1px solid rgba(255,184,28,0.35)', color: '#ffb81c', fontFamily: 'var(--font-space-mono)', letterSpacing: '0.05em' }}>
                FREE · up to {FREE_APPLY_LIMIT} actions
              </span>
            )}
            {isSubscribed && (
              <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 999, background: 'rgba(0,217,126,0.1)', border: '1px solid rgba(0,217,126,0.3)', color: '#00d97e', fontFamily: 'var(--font-space-mono)' }}>
                PRO · unlimited
              </span>
            )}
          </div>
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
              onClick={requestApply}
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
              Selected: {selectedDecisionIds.size}{selectedDecisionIds.size > 0 && safeNowCount > 0 && selectedDecisionIds.size === safeNowCount ? ' (auto)' : ''}
            </span>
          </div>
          <div style={{ marginBottom: 8, fontSize: 13, opacity: 0.9 }}>
            <p style={{ margin: 0 }}>Nothing is deleted without your approval</p>
            <p style={{ margin: '4px 0 0 0' }}>You can review every action before applying</p>
          </div>
          {(paymentPending || paymentCheckAgain) && (
            <div style={{ marginTop: 8, marginBottom: 8, padding: '10px 14px', background: 'rgba(80,200,120,0.12)', border: '1px solid #50c878', borderRadius: 6 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                {paymentPending ? '⏳ Payment processing — activating your subscription...' : '⚠️ Subscription not detected yet'}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.85 }}>
                {paymentPending ? "This usually takes a few seconds. You'll be unlocked automatically." : 'It may take a moment. Click below to check again.'}
              </p>
              {paymentCheckAgain && (
                <button className={styles.btnOutline} style={{ marginTop: 8 }} onClick={checkSubscriptionNow}>
                  Check again
                </button>
              )}
            </div>
          )}
          {needsUpgrade && !paymentPending && (
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700 }}>
                Finish cleaning your inbox
              </p>
              <p style={{ margin: '0 0 4px 0', fontSize: 14 }}>
                {upgradeMessage}
              </p>
              {upgradeRemainingCount > 0 && (
                <p style={{ margin: '0 0 8px 0', fontSize: 13, opacity: 0.85 }}>
                  {upgradeRemainingCount} action{upgradeRemainingCount !== 1 ? 's' : ''} still pending
                </p>
              )}
              <button
                className={styles.btnPrimary}
                onClick={startCheckoutUpgrade}
                disabled={upgradeLoading}
              >
                {upgradeLoading ? 'REDIRECTING...' : 'Upgrade to clean everything'}
              </button>
              {upgradeError && (
                <p style={{ margin: '8px 0 0 0', color: '#ff6b6b', fontSize: 13 }}>
                  {upgradeError}
                </p>
              )}
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
            <p style={{ margin: '10px 0 0 0', color: '#ff6b6b', fontSize: 14, padding: '8px 12px', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 6 }}>
              {renderError(executionError)}
            </p>
          )}
          {executionResult && (() => {
            const appliedTotal = executionResult.applied.delete + executionResult.applied.archive + executionResult.applied.keep + executionResult.applied.reply;
            const skippedByReason = executionResult.results
              ? executionResult.results.filter(r => r.status === 'skipped').reduce<Record<string, number>>((acc, r) => {
                  const key = r.reason || 'unknown';
                  acc[key] = (acc[key] || 0) + 1;
                  return acc;
                }, {})
              : {};
            const skippedDetail = Object.entries(skippedByReason).map(([k, v]) => `${v} ${k}`).join(', ');
            return (
              <div style={{ margin: '10px 0 0 0', fontSize: 14 }}>
                <p style={{ margin: 0 }}>
                  Applied {appliedTotal} · Deleted {executionResult.applied.delete} · Archived {executionResult.applied.archive}
                </p>
                {executionResult.skipped > 0 && (
                  <p style={{ margin: '4px 0 0 0', opacity: 0.85 }}>
                    Skipped {executionResult.skipped}{skippedDetail ? ` (${skippedDetail})` : ''} · Errors {executionResult.errors}
                  </p>
                )}
              </div>
            );
          })()}
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
                <strong>Details</strong> · {new Date(selectedHistoryRecord.executedAt).toLocaleString()}
              </p>
              <p style={{ margin: '0 0 4px 0' }}>
                Deleted: {selectedHistoryRecord.result.applied.delete} · Archived: {selectedHistoryRecord.result.applied.archive} · Kept: {selectedHistoryRecord.result.applied.keep} · Replied: {selectedHistoryRecord.result.applied.reply}
              </p>
              <p style={{ margin: 0, opacity: 0.8 }}>
                Skipped: {selectedHistoryRecord.result.skipped} · Errors: {selectedHistoryRecord.result.errors} · Actions submitted: {selectedHistoryRecord.selectedDecisionIds.length}
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

      {/* Apply confirmation modal — P0 #2 */}
      {applyConfirmData && (
        <div className={styles.modalOverlay} onClick={() => setApplyConfirmData(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTag}>// confirm_apply</p>
            <h2 className={styles.modalTitle}>Review before applying</h2>
            <p className={styles.modalSub}>
              You are about to apply <strong>{applyConfirmData.total}</strong> action{applyConfirmData.total !== 1 ? 's' : ''}:
            </p>
            <ul style={{ margin: '8px 0 16px 0', paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>
              {applyConfirmData.deleteCount > 0 && (
                <li><strong style={{ color: '#ff6b6b' }}>{applyConfirmData.deleteCount} delete{applyConfirmData.deleteCount !== 1 ? 's' : ''}</strong> — moved to Trash</li>
              )}
              {applyConfirmData.archiveCount > 0 && (
                <li><strong style={{ color: '#ffb86c' }}>{applyConfirmData.archiveCount} archive{applyConfirmData.archiveCount !== 1 ? 's' : ''}</strong> — removed from inbox</li>
              )}
            </ul>
            <div className={styles.modalWarning}>
              ⚠ Deleted emails go to Trash and can be recovered for 30 days.
            </div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setApplyConfirmData(null)}>CANCEL</button>
              <button className={styles.modalConfirm} onClick={executeApproved}>CONFIRM &amp; APPLY</button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome modal — P1 #5 */}
      {showWelcome && (
        <div className={styles.modalOverlay} onClick={() => setShowWelcome(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTag}>// welcome</p>
            <h2 className={styles.modalTitle}>Welcome to GetCleanInbox</h2>
            <p className={styles.modalSub}>Here is how it works in 3 steps:</p>
            <ol style={{ margin: '8px 0 16px 0', paddingLeft: 20, fontSize: 14, lineHeight: 2 }}>
              <li><strong style={{ color: '#00d97e' }}>Connect Gmail</strong> — grant inbox access (separate from your login)</li>
              <li><strong style={{ color: '#00d97e' }}>Preview</strong> — AI scans emails older than 6 months and suggests safe actions</li>
              <li><strong style={{ color: '#00d97e' }}>Clean</strong> — review and apply. Deletes go to Trash, recoverable for 30 days</li>
            </ol>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, opacity: 0.7 }}>Free plan: up to 50 actions per session. Pro: unlimited.</p>
            <div className={styles.modalActions}>
              <button className={styles.modalConfirm} onClick={() => setShowWelcome(false)}>GET STARTED →</button>
            </div>
          </div>
        </div>
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
