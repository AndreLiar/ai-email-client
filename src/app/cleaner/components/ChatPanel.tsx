import { useRef, useEffect, RefObject } from 'react';
import ReactMarkdown from 'react-markdown';
import type { UIMessage } from 'ai';
import styles from '../cleaner.module.css';

const TOOL_LABELS: Record<string, string> = {
  scanInbox:              '🔍 Scanning inbox...',
  classifyAllSenders:     '🏷️  Classifying all senders...',
  classifySenders:        '🏷️  Classifying senders...',
  deleteEmailsFromSender: '🗑️  Deleting emails...',
  unsubscribeFromSender:  '✉️  Unsubscribing...',
};

const TOOL_DONE: Record<string, (r: any) => string> = {
  scanInbox:              r => `✓ Scanned ${r?.totalScanned ?? 0} emails — ${r?.senders?.length ?? 0} senders found`,
  classifyAllSenders:     r => `✓ Classified ${r?.classifications?.length ?? 0} senders`,
  classifySenders:        r => `✓ Classified ${r?.classifications?.length ?? 0} senders`,
  deleteEmailsFromSender: r => `✓ Trashed ${r?.deleted ?? 0} emails from ${r?.senderEmail}`,
  unsubscribeFromSender:  r => `✓ Unsubscribed from ${r?.senderEmail} (${r?.method ?? 'none'})`,
};

interface Props {
  messages: UIMessage[];
  status: string;
  chatInput: string;
  setChatInput: (v: string) => void;
  sendMessage: (msg: { text: string }) => void;
  chatBodyRef: RefObject<HTMLDivElement | null>;
  chatInputRef: RefObject<HTMLInputElement | null>;
}

export default function ChatPanel({
  messages, status, chatInput, setChatInput, sendMessage, chatBodyRef, chatInputRef,
}: Props) {
  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (status === 'ready' && messages.length > 0) {
      const t = setTimeout(() => chatInputRef.current?.focus({ preventScroll: true }), 100);
      return () => clearTimeout(t);
    }
  }, [status]);

  const getText = (m: UIMessage) =>
    m.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('');

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatBar}>
        <div className={styles.chatBarDots}>
          <div className={`${styles.dot} ${styles.dotR}`} />
          <div className={`${styles.dot} ${styles.dotY}`} />
          <div className={`${styles.dot} ${styles.dotG}`} />
        </div>
        <span className={styles.chatBarTitle}>agent — gemini-2.0-flash · vercel ai sdk v6</span>
        <div style={{ width: 46 }} />
      </div>

      <div className={styles.chatBody} ref={chatBodyRef}>
        {messages.length === 0 && (
          <div className={styles.chatEmpty}>
            <span style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 0 10px rgba(0,217,126,0.3))' }}>◈</span>
            <span>ASK THE AGENT TO SCAN, CLASSIFY, OR CLEAN YOUR INBOX</span>
          </div>
        )}
        {messages.map(m => {
          const isUser = m.role === 'user';
          const text = getText(m);
          const toolParts: any[] = isUser ? [] : m.parts.filter(p => p.type === 'tool-invocation');
          if (!text && toolParts.length === 0) return null;

          return (
            <div key={m.id} className={isUser ? styles.msgUser : styles.msgAgent}>
              <div style={{ maxWidth: '85%' }}>
                <div className={`${styles.msgLabel} ${isUser ? styles.msgLabelUser : styles.msgLabelAgent}`}>
                  {isUser ? 'YOU' : 'AGENT'}
                </div>
                {toolParts.map((p, i) => {
                  const name = p.toolInvocation?.toolName ?? p.toolName ?? '';
                  const state = p.toolInvocation?.state ?? p.state ?? '';
                  const result = state === 'result' ? (p.toolInvocation?.result ?? p.result) : null;
                  const isDone = state === 'result';
                  return (
                    <div key={i} className={styles.toolStep}>
                      {!isDone && (
                        <span style={{ display: 'flex', gap: 3 }}>
                          {[0, 1, 2].map(j => (
                            <span key={j} className={styles.thinkingDot} style={{ animationDelay: `${j * 0.2}s` }} />
                          ))}
                        </span>
                      )}
                      <span style={{ color: isDone ? '#00d97e' : '#4a6a54' }}>
                        {isDone
                          ? (TOOL_DONE[name]?.(result) ?? `✓ ${name} done`)
                          : (TOOL_LABELS[name] ?? `Running ${name}...`)}
                      </span>
                    </div>
                  );
                })}
                {text && (
                  <div className={`${styles.msgBubble} ${isUser ? styles.msgBubbleUser : styles.msgBubbleAgent}`}>
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className={styles.thinking}>
            <div className={styles.thinkingDot} />
            <div className={styles.thinkingDot} />
            <div className={styles.thinkingDot} />
            <span>AGENT IS WORKING</span>
          </div>
        )}
      </div>

      <div className={styles.chatFooter}>
        <form
          className={styles.chatInputRow}
          onSubmit={e => {
            e.preventDefault();
            if (!chatInput.trim() || isLoading) return;
            sendMessage({ text: chatInput });
            setChatInput('');
          }}
        >
          <input
            ref={chatInputRef}
            className={styles.chatInput}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder='e.g. "scan my inbox and delete all job alerts"'
          />
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={isLoading || !chatInput.trim()}
            style={{ padding: '0.5rem 1.25rem' }}
          >
            SEND
          </button>
        </form>
        <div className={styles.suggestions}>
          {['Scan my inbox', 'Classify senders', 'Delete job alerts', 'Unsubscribe newsletters'].map(p => (
            <button
              key={p}
              className={styles.suggestion}
              onClick={() => sendMessage({ text: p })}
              disabled={isLoading}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
