'use client';

import Link from 'next/link';
import { track } from '@/lib/analytics';

export default function LandingPage() {
  const handleConnectCtaClick = () => {
    track('cta_connect_clicked');
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        .lp-root {
          background: #06090f;
          color: #c8d8cc;
          font-family: var(--font-syne), sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* ── grid bg ── */
        .lp-root::before {
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

        /* ── nav ── */
        .lp-nav {
          position: relative;
          z-index: 10;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 4rem;
          border-bottom: 1px solid rgba(0,217,126,0.1);
        }
        .lp-logo {
          font-family: var(--font-space-mono), monospace;
          font-size: 1rem;
          color: #00d97e;
          text-decoration: none;
          letter-spacing: 0.05em;
        }
        .lp-logo span { color: #c8d8cc; }
        .lp-nav-cta {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.75rem;
          padding: 0.5rem 1.25rem;
          background: transparent;
          border: 1px solid #00d97e;
          color: #00d97e;
          text-decoration: none;
          letter-spacing: 0.08em;
          transition: background 0.2s, color 0.2s;
        }
        .lp-nav-cta:hover { background: #00d97e; color: #06090f; }

        /* ── hero ── */
        .lp-hero {
          position: relative;
          z-index: 1;
          min-height: 90vh;
          display: flex;
          align-items: center;
          padding: 6rem 4rem 4rem;
          gap: 4rem;
        }
        .lp-hero-content { flex: 1; max-width: 580px; }
        .lp-eyebrow {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          color: #00d97e;
          text-transform: uppercase;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .lp-eyebrow::before {
          content: '';
          display: inline-block;
          width: 24px;
          height: 1px;
          background: #00d97e;
        }
        .lp-h1 {
          font-size: clamp(2.8rem, 5vw, 4.5rem);
          font-weight: 800;
          line-height: 1.05;
          margin-bottom: 1.5rem;
          color: #f0f7f2;
          letter-spacing: -0.02em;
        }
        .lp-h1 em {
          font-style: normal;
          background: linear-gradient(135deg, #00d97e 0%, #00ffb3 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-sub {
          font-size: 1.1rem;
          color: #7a9a84;
          line-height: 1.7;
          margin-bottom: 2.5rem;
          max-width: 480px;
        }
        .lp-cta-row {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .lp-trust-list {
          margin-top: 1rem;
          display: grid;
          gap: 0.35rem;
          color: #7a9a84;
          font-size: 0.9rem;
        }
        .lp-social-proof {
          margin-top: 1rem;
          color: #9db8a4;
          font-size: 0.9rem;
        }
        .lp-btn-primary {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.8rem;
          letter-spacing: 0.1em;
          padding: 0.9rem 2rem;
          background: #00d97e;
          color: #06090f;
          text-decoration: none;
          font-weight: 700;
          border: none;
          transition: transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 0 30px rgba(0,217,126,0.25);
        }
        .lp-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 50px rgba(0,217,126,0.4);
          color: #06090f;
        }
        .lp-btn-ghost {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.8rem;
          letter-spacing: 0.1em;
          padding: 0.9rem 2rem;
          background: transparent;
          color: #c8d8cc;
          text-decoration: none;
          border: 1px solid rgba(200,216,204,0.2);
          transition: border-color 0.2s, color 0.2s;
        }
        .lp-btn-ghost:hover { border-color: #00d97e; color: #00d97e; }

        /* ── terminal widget ── */
        .lp-terminal {
          flex: 1;
          max-width: 460px;
          background: #0b1018;
          border: 1px solid rgba(0,217,126,0.15);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 0 80px rgba(0,217,126,0.08), 0 40px 80px rgba(0,0,0,0.5);
        }
        .lp-terminal-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.75rem 1rem;
          background: #0f1a20;
          border-bottom: 1px solid rgba(0,217,126,0.1);
        }
        .lp-dot { width: 10px; height: 10px; border-radius: 50%; }
        .lp-dot-r { background: #ff5f57; }
        .lp-dot-y { background: #ffbd2e; }
        .lp-dot-g { background: #28c840; }
        .lp-terminal-title {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.65rem;
          color: #4a6a54;
          margin-left: auto;
          letter-spacing: 0.05em;
        }
        .lp-terminal-body {
          padding: 1.25rem;
          font-family: var(--font-space-mono), monospace;
          font-size: 0.72rem;
          line-height: 2;
        }
        .lp-t-prompt { color: #4a6a54; }
        .lp-t-cmd { color: #00d97e; }
        .lp-t-out { color: #5a8a64; padding-left: 1rem; }
        .lp-t-del { color: #ff5f57; padding-left: 1rem; }
        .lp-t-ok { color: #00d97e; padding-left: 1rem; }
        .lp-t-dim { color: #2a4a34; padding-left: 1rem; }
        .lp-cursor {
          display: inline-block;
          width: 7px;
          height: 14px;
          background: #00d97e;
          vertical-align: middle;
          animation: lp-blink 1s step-end infinite;
        }
        @keyframes lp-blink { 0%,100%{opacity:1} 50%{opacity:0} }

        .lp-scan-line {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 1rem 0.25rem 1.25rem;
          animation: lp-scan-in 0.3s ease forwards;
          opacity: 0;
        }
        .lp-scan-line:nth-child(1) { animation-delay: 0.2s; }
        .lp-scan-line:nth-child(2) { animation-delay: 0.5s; }
        .lp-scan-line:nth-child(3) { animation-delay: 0.8s; }
        .lp-scan-line:nth-child(4) { animation-delay: 1.1s; }
        .lp-scan-line:nth-child(5) { animation-delay: 1.4s; }
        .lp-scan-line:nth-child(6) { animation-delay: 1.7s; }
        .lp-scan-line:nth-child(7) { animation-delay: 2.0s; }
        .lp-scan-line:nth-child(8) { animation-delay: 2.3s; }
        @keyframes lp-scan-in {
          from { opacity:0; transform: translateX(-6px); }
          to   { opacity:1; transform: translateX(0); }
        }

        /* ── stats bar ── */
        .lp-stats {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: center;
          gap: 4rem;
          padding: 2rem 4rem;
          border-top: 1px solid rgba(0,217,126,0.08);
          border-bottom: 1px solid rgba(0,217,126,0.08);
          flex-wrap: wrap;
        }
        .lp-stat-num {
          font-size: 2.2rem;
          font-weight: 800;
          color: #00d97e;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .lp-stat-label {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.65rem;
          color: #4a6a54;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-top: 0.3rem;
        }

        /* ── section ── */
        .lp-section {
          position: relative;
          z-index: 1;
          padding: 6rem 4rem;
        }
        .lp-section-tag {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.65rem;
          letter-spacing: 0.2em;
          color: #00d97e;
          text-transform: uppercase;
          margin-bottom: 0.75rem;
        }
        .lp-section-h2 {
          font-size: clamp(1.8rem, 3vw, 2.8rem);
          font-weight: 800;
          color: #f0f7f2;
          letter-spacing: -0.02em;
          margin-bottom: 1rem;
          max-width: 520px;
        }
        .lp-section-sub {
          color: #4a6a54;
          font-size: 0.95rem;
          max-width: 460px;
          line-height: 1.7;
          margin-bottom: 3.5rem;
        }

        /* ── feature cards ── */
        .lp-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }
        @media (max-width: 900px) { .lp-cards { grid-template-columns: 1fr; } }
        .lp-card {
          background: #0b1018;
          border: 1px solid rgba(0,217,126,0.1);
          border-radius: 6px;
          overflow: hidden;
          transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        .lp-card:hover {
          border-color: rgba(0,217,126,0.35);
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 30px rgba(0,217,126,0.06);
        }
        .lp-card-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.6rem 0.9rem;
          background: #0f1a20;
          border-bottom: 1px solid rgba(0,217,126,0.08);
        }
        .lp-card-body { padding: 1.75rem; }
        .lp-card-icon {
          font-size: 2rem;
          margin-bottom: 1rem;
          display: block;
          filter: drop-shadow(0 0 12px rgba(0,217,126,0.4));
        }
        .lp-card-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: #f0f7f2;
          margin-bottom: 0.6rem;
          letter-spacing: -0.01em;
        }
        .lp-card-text {
          font-size: 0.875rem;
          color: #4a6a54;
          line-height: 1.7;
        }

        /* ── how it works ── */
        .lp-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          position: relative;
        }
        .lp-steps::before {
          content: '';
          position: absolute;
          top: 26px;
          left: calc(16.66% + 1rem);
          right: calc(16.66% + 1rem);
          height: 1px;
          background: repeating-linear-gradient(
            90deg,
            rgba(0,217,126,0.3) 0,
            rgba(0,217,126,0.3) 6px,
            transparent 6px,
            transparent 14px
          );
        }
        @media (max-width: 900px) {
          .lp-steps { grid-template-columns: 1fr; }
          .lp-steps::before { display: none; }
        }
        .lp-step { padding: 0 2rem 0 0; }
        .lp-step-num {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 1px solid rgba(0,217,126,0.4);
          background: #06090f;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-space-mono), monospace;
          font-size: 0.85rem;
          color: #00d97e;
          margin-bottom: 1.5rem;
          position: relative;
          z-index: 1;
        }
        .lp-step-title {
          font-size: 1rem;
          font-weight: 700;
          color: #f0f7f2;
          margin-bottom: 0.5rem;
        }
        .lp-step-text {
          font-size: 0.85rem;
          color: #4a6a54;
          line-height: 1.7;
        }

        /* ── final cta ── */
        .lp-cta-section {
          position: relative;
          z-index: 1;
          margin: 0 4rem 6rem;
          padding: 5rem;
          border: 1px solid rgba(0,217,126,0.15);
          background: #0b1018;
          text-align: center;
          overflow: hidden;
        }
        .lp-cta-section::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 60% at 50% 100%, rgba(0,217,126,0.07) 0%, transparent 70%);
          pointer-events: none;
        }
        .lp-cta-h2 {
          font-size: clamp(2rem, 4vw, 3.2rem);
          font-weight: 800;
          color: #f0f7f2;
          letter-spacing: -0.02em;
          margin-bottom: 1rem;
          position: relative;
        }
        .lp-cta-sub {
          color: #4a6a54;
          font-size: 1rem;
          margin-bottom: 2.5rem;
          position: relative;
        }

        /* ── pricing ── */
        .lp-pricing-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          max-width: 760px;
        }
        @media (max-width: 640px) { .lp-pricing-grid { grid-template-columns: 1fr; } }

        .lp-plan {
          background: #0b1018;
          border: 1px solid rgba(0,217,126,0.1);
          border-radius: 6px;
          padding: 2rem;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .lp-plan-pro {
          border-color: rgba(0,217,126,0.4);
          box-shadow: 0 0 40px rgba(0,217,126,0.07);
        }
        .lp-plan-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: #00d97e;
          color: #06090f;
          font-family: var(--font-space-mono), monospace;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          padding: 3px 12px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .lp-plan-tag {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.6rem;
          letter-spacing: 0.2em;
          color: #4a6a54;
          margin-bottom: 0.75rem;
        }
        .lp-plan-price {
          font-size: 2.8rem;
          font-weight: 800;
          color: #7a9a84;
          line-height: 1;
          letter-spacing: -0.02em;
          margin-bottom: 0.25rem;
        }
        .lp-plan-per {
          font-size: 1rem;
          font-weight: 400;
          opacity: 0.6;
        }
        .lp-plan-name {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          color: #4a6a54;
          text-transform: uppercase;
          margin-bottom: 1.5rem;
        }
        .lp-plan-features {
          list-style: none;
          padding: 0;
          margin: 0 0 1.75rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          flex: 1;
          font-size: 0.875rem;
          color: #7a9a84;
          line-height: 1.4;
        }
        .lp-plan-features strong { color: #f0f7f2; }
        .lp-plan-dim { opacity: 0.35; }
        .lp-plan-btn-primary {
          display: block;
          text-align: center;
          font-family: var(--font-space-mono), monospace;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          padding: 0.85rem 1.5rem;
          background: #00d97e;
          color: #06090f;
          text-decoration: none;
          border-radius: 4px;
          transition: box-shadow 0.2s, transform 0.15s;
        }
        .lp-plan-btn-primary:hover {
          box-shadow: 0 0 30px rgba(0,217,126,0.35);
          transform: translateY(-1px);
          color: #06090f;
        }
        .lp-plan-btn-ghost {
          display: block;
          text-align: center;
          font-family: var(--font-space-mono), monospace;
          font-size: 0.78rem;
          letter-spacing: 0.1em;
          padding: 0.85rem 1.5rem;
          background: transparent;
          color: #7a9a84;
          text-decoration: none;
          border: 1px solid rgba(0,217,126,0.15);
          border-radius: 4px;
          transition: border-color 0.2s, color 0.2s;
        }
        .lp-plan-btn-ghost:hover { border-color: rgba(0,217,126,0.4); color: #c8d8cc; }
        .lp-plan-note {
          margin: 0.75rem 0 0 0;
          text-align: center;
          font-size: 0.7rem;
          color: #4a6a54;
          font-family: var(--font-space-mono), monospace;
        }

        /* ── footer ── */
        .lp-footer {
          position: relative;
          z-index: 1;
          border-top: 1px solid rgba(0,217,126,0.08);
          padding: 2rem 4rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .lp-footer-copy {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.65rem;
          color: #2a4a34;
          letter-spacing: 0.08em;
        }

        @media (max-width: 768px) {
          .lp-nav { padding: 1.25rem 1.5rem; }
          .lp-hero { padding: 4rem 1.5rem 3rem; flex-direction: column; min-height: auto; }
          .lp-terminal { max-width: 100%; }
          .lp-section { padding: 4rem 1.5rem; }
          .lp-stats { gap: 2rem; padding: 1.5rem; }
          .lp-cta-section { margin: 0 1.5rem 4rem; padding: 3rem 1.5rem; }
          .lp-footer { padding: 1.5rem; flex-direction: column; gap: 1rem; }
        }
      `}</style>

      <div className="lp-root">
        {/* ── Nav ── */}
        <nav className="lp-nav">
          <Link href="/" className="lp-logo">get<span>cleaninbox</span>.xyz</Link>
          <Link href="/cleaner" className="lp-nav-cta">LAUNCH APP →</Link>
        </nav>

        {/* ── Hero ── */}
        <section className="lp-hero">
          <div className="lp-hero-content">
            <p className="lp-eyebrow">Powered by Gemini AI</p>
            <h1 className="lp-h1">
              Clean your Gmail inbox in seconds with <em>AI</em>
            </h1>
            <p className="lp-sub">
              Automatically find and remove unwanted emails, unsubscribe in bulk,
              and take control of your inbox.
            </p>
            <div className="lp-cta-row">
              <Link href="/cleaner" className="lp-btn-primary" onClick={handleConnectCtaClick}>
                Connect Gmail &amp; See My Cleanup Plan
              </Link>
            </div>
            <div className="lp-social-proof">
              Used by early users to clean thousands of emails
            </div>
            <div className="lp-trust-list">
              <span>Secure Google OAuth</span>
              <span>No emails are deleted without your approval</span>
            </div>
          </div>

          {/* Terminal widget */}
          <div className="lp-terminal">
            <div className="lp-terminal-bar">
              <div className="lp-dot lp-dot-r" />
              <div className="lp-dot lp-dot-y" />
              <div className="lp-dot lp-dot-g" />
              <span className="lp-terminal-title">inbox-cleaner — scan</span>
            </div>
            <div className="lp-terminal-body">
              <div><span className="lp-t-prompt">$ </span><span className="lp-t-cmd">scan --inbox --categories=promo,updates</span></div>
              <div className="lp-t-out">↳ Scanning 300 emails...</div>
              <div className="lp-t-out" style={{color:'#2a6a4a'}}>——————————————————————</div>
              <div className="lp-scan-line lp-t-del">✕  52× Google Job Alerts</div>
              <div className="lp-scan-line lp-t-del">✕  34× trabajo.org</div>
              <div className="lp-scan-line lp-t-del">✕  24× AI For Work (beehiiv)</div>
              <div className="lp-scan-line lp-t-del">✕  20× Skool Community</div>
              <div className="lp-scan-line lp-t-del">✕  15× Skyscanner</div>
              <div className="lp-scan-line lp-t-del">✕  12× Netflix Promos</div>
              <div className="lp-scan-line lp-t-ok" style={{animationDelay:'2.6s', opacity:0}}>✓  187 emails → Trash</div>
              <div className="lp-scan-line lp-t-ok" style={{animationDelay:'2.9s', opacity:0}}>✓  8 senders unsubscribed</div>
              <div style={{marginTop:'0.5rem'}}>
                <span className="lp-t-prompt">$ </span>
                <span className="lp-cursor" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <div className="lp-stats">
          {[
            ['300+', 'EMAILS SCANNED'],
            ['1-CLICK', 'BULK DELETE'],
            ['3', 'UNSUBSCRIBE METHODS'],
            ['60s', 'AVERAGE CLEANUP'],
          ].map(([num, label]) => (
            <div key={label} style={{textAlign:'center'}}>
              <div className="lp-stat-num">{num}</div>
              <div className="lp-stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Features ── */}
        <section className="lp-section">
          <p className="lp-section-tag">// features</p>
          <h2 className="lp-section-h2">Everything you need to reclaim your inbox</h2>
          <p className="lp-section-sub">
            Built on the Gmail API and Gemini 1.5 Flash. No third-party access to your emails.
          </p>
          <div className="lp-cards">
            {[
              {
                icon: '🔍',
                title: 'AI-Powered Scanning',
                text: 'Gemini classifies every sender — newsletters, job alerts, promos, social — so you can act on entire categories at once.',
              },
              {
                icon: '🗑️',
                title: 'One-Click Bulk Delete',
                text: 'Select any number of senders and trash all their emails instantly. Handles up to 1,000 messages per sender in one shot.',
              },
              {
                icon: '✉️',
                title: 'Auto-Unsubscribe',
                text: 'Detects List-Unsubscribe headers and fires one-click POST requests or mailto emails — so senders stop reaching you permanently.',
              },
            ].map(({ icon, title, text }) => (
              <div className="lp-card" key={title}>
                <div className="lp-card-header">
                  <div className="lp-dot lp-dot-r" />
                  <div className="lp-dot lp-dot-y" />
                  <div className="lp-dot lp-dot-g" />
                </div>
                <div className="lp-card-body">
                  <span className="lp-card-icon">{icon}</span>
                  <div className="lp-card-title">{title}</div>
                  <p className="lp-card-text">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="lp-section" style={{paddingTop: 0}}>
          <p className="lp-section-tag">// how_it_works</p>
          <h2 className="lp-section-h2">Three steps. Zero noise.</h2>
          <p className="lp-section-sub" style={{marginBottom: '4rem'}}>
            From cluttered to clean in under a minute.
          </p>
          <div className="lp-steps">
            {[
              {
                n: '01',
                title: 'Connect Gmail',
                text: 'Securely connect your Gmail account with Google OAuth.',
              },
              {
                n: '02',
                title: 'Review AI cleanup plan',
                text: 'See what can be safely archived, deleted, kept, or reviewed.',
              },
              {
                n: '03',
                title: 'Clean your inbox in one click',
                text: 'Apply safe actions and clear inbox clutter in seconds.',
              },
            ].map(({ n, title, text }) => (
              <div className="lp-step" key={n}>
                <div className="lp-step-num">{n}</div>
                <div className="lp-step-title">{title}</div>
                <p className="lp-step-text">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="lp-section" style={{paddingTop: 0}}>
          <p className="lp-section-tag">// pricing</p>
          <h2 className="lp-section-h2">Simple pricing. No surprises.</h2>
          <p className="lp-section-sub">
            Start free. Upgrade when you need to clean everything at once.
          </p>
          <div className="lp-pricing-grid">

            {/* Free */}
            <div className="lp-plan">
              <div className="lp-plan-header">
                <div className="lp-plan-tag">// free</div>
                <div className="lp-plan-price">$0<span className="lp-plan-per">/month</span></div>
                <div className="lp-plan-name">Starter</div>
              </div>
              <ul className="lp-plan-features">
                <li>✓ Scan full inbox</li>
                <li>✓ AI cleanup plan</li>
                <li>✓ Apply up to 50 actions</li>
                <li>✓ Bulk delete by sender</li>
                <li>✓ Auto-unsubscribe</li>
                <li className="lp-plan-dim">✗ Unlimited actions</li>
                <li className="lp-plan-dim">✗ Full inbox cleanup in one click</li>
              </ul>
              <Link href="/cleaner" className="lp-plan-btn-ghost">
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="lp-plan lp-plan-pro">
              <div className="lp-plan-badge">MOST POPULAR</div>
              <div className="lp-plan-header">
                <div className="lp-plan-tag" style={{color:'#00d97e'}}>// pro</div>
                <div className="lp-plan-price" style={{color:'#f0f7f2'}}>$9<span className="lp-plan-per">/month</span></div>
                <div className="lp-plan-name">Pro</div>
              </div>
              <ul className="lp-plan-features">
                <li>✓ Everything in Free</li>
                <li>✓ <strong>Unlimited actions</strong></li>
                <li>✓ Full inbox cleanup in one click</li>
                <li>✓ AI decisions on all emails</li>
                <li>✓ Priority AI processing</li>
                <li>✓ Execution history</li>
                <li>✓ Cancel anytime</li>
              </ul>
              <Link href="/cleaner" className="lp-plan-btn-primary">
                Start cleaning →
              </Link>
              <p className="lp-plan-note">No credit card required to start</p>
            </div>

          </div>
        </section>

        {/* ── Final CTA ── */}
        <div className="lp-cta-section">
          <h2 className="lp-cta-h2">Ready to clean up?</h2>
          <p className="lp-cta-sub">
            Connect your Gmail and let the agent handle the rest.
          </p>
          <div className="lp-cta-row" style={{ justifyContent: 'center' }}>
            <Link href="/cleaner" className="lp-btn-primary" onClick={handleConnectCtaClick}>
              Connect Gmail &amp; See My Cleanup Plan
            </Link>
            <Link href="/cleaner" className="lp-btn-ghost">
              Try it free
            </Link>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="lp-footer">
          <span className="lp-footer-copy">© 2026 GETCLEANINBOX — POWERED BY GEMINI + VERCEL AI SDK</span>
          <div style={{display:'flex',gap:'1.5rem',alignItems:'center'}}>
            <Link href="/privacy" className="lp-footer-copy" style={{color:'#4a6a54',textDecoration:'none'}}>Privacy Policy</Link>
            <Link href="/terms" className="lp-footer-copy" style={{color:'#4a6a54',textDecoration:'none'}}>Terms</Link>
            <Link href="/cleaner" className="lp-logo" style={{fontSize:'0.75rem'}}>
              get<span>cleaninbox</span>.xyz
            </Link>
          </div>
        </footer>
      </div>
    </>
  );
}
