export const metadata = {
  title: 'Privacy Policy — GetCleanInbox',
};

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <>
      <style>{`
        .legal-root {
          background: #06090f;
          min-height: 100vh;
          color: #c8d8cc;
          font-family: var(--font-space-mono), monospace;
          padding: 4rem 1.5rem;
        }
        .legal-wrap {
          max-width: 720px;
          margin: 0 auto;
        }
        .legal-logo {
          font-size: 1rem;
          color: #00d97e;
          text-decoration: none;
          letter-spacing: 0.05em;
          display: inline-block;
          margin-bottom: 2.5rem;
        }
        .legal-logo span { color: #c8d8cc; }
        .legal-root h1 {
          font-family: var(--font-syne), sans-serif;
          font-size: 1.8rem;
          font-weight: 700;
          color: #f0f7f2;
          margin-bottom: 0.5rem;
        }
        .legal-date {
          font-size: 0.7rem;
          color: #4a6a54;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 2.5rem;
        }
        .legal-root h2 {
          font-size: 0.85rem;
          color: #00d97e;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin: 2rem 0 0.75rem;
        }
        .legal-root p, .legal-root li {
          font-size: 0.8rem;
          line-height: 1.9;
          color: #7a9a84;
          margin-bottom: 0.75rem;
        }
        .legal-root ul { padding-left: 1.25rem; }
        .legal-root a { color: #00d97e; }
        hr {
          border: none;
          border-top: 1px solid rgba(0,217,126,0.1);
          margin: 2rem 0;
        }
      `}</style>

      <div className="legal-root">
        <div className="legal-wrap">
          <Link href="/" className="legal-logo">get<span>cleaninbox</span>.xyz</Link>

          <h1>Privacy Policy</h1>
          <p className="legal-date">Last updated: April 19, 2026</p>

          <p>
            GetCleanInbox (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates getcleaninbox.xyz.
            This policy explains what data we collect, how we use it, and your rights.
          </p>

          <hr />

          <h2>1. Data We Collect</h2>
          <ul>
            <li><strong>Account identity</strong> — your name and email address via Google sign-in (Clerk).</li>
            <li><strong>Gmail access tokens</strong> — OAuth tokens that allow us to read and manage your Gmail inbox on your behalf. These are stored encrypted in our database.</li>
            <li><strong>Email metadata</strong> — sender addresses, subject lines, and dates of emails scanned during a session. We do not store email body content.</li>
            <li><strong>Usage data</strong> — actions taken in the app (e.g. emails deleted, senders unsubscribed) for history and billing purposes.</li>
          </ul>

          <h2>2. How We Use Your Data</h2>
          <ul>
            <li>To scan your Gmail inbox for old unread emails and surface bulk-action suggestions.</li>
            <li>To execute actions you explicitly approve (delete, unsubscribe).</li>
            <li>To maintain your subscription and billing status via Stripe.</li>
            <li>We do not sell, rent, or share your data with third parties for advertising.</li>
          </ul>

          <h2>3. Gmail API Usage</h2>
          <p>
            GetCleanInbox uses the Gmail API to read email metadata and perform actions (delete, send unsubscribe requests) that you explicitly initiate.
            Our use of Gmail data is limited to providing the in-app features you request.
            We do not use Gmail data for AI model training, advertising, or any purpose beyond the core product functionality.
          </p>
          <p>
            GetCleanInbox&apos;s use and transfer of information received from Google APIs adheres to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>

          <h2>4. Data Retention</h2>
          <ul>
            <li>Gmail tokens are deleted when you disconnect your Gmail account or delete your account.</li>
            <li>Action history is retained for 90 days, then purged.</li>
            <li>You can request deletion of all your data at any time by contacting us.</li>
          </ul>

          <h2>5. Third-Party Services</h2>
          <ul>
            <li><strong>Clerk</strong> — authentication and identity management.</li>
            <li><strong>Google (Gmail API)</strong> — inbox access.</li>
            <li><strong>Stripe</strong> — payment processing. We do not store card details.</li>
            <li><strong>Vercel</strong> — hosting and infrastructure.</li>
            <li><strong>Neon</strong> — encrypted PostgreSQL database.</li>
          </ul>

          <h2>6. Security</h2>
          <p>
            All data is transmitted over HTTPS. Gmail tokens are stored encrypted at rest.
            We follow industry-standard security practices to protect your information.
          </p>

          <h2>7. Your Rights</h2>
          <p>
            You can disconnect your Gmail account, delete your account, or request a copy or deletion of your data
            at any time by emailing us at <a href="mailto:kanmegnea@gmail.com">kanmegnea@gmail.com</a>.
          </p>

          <h2>8. Contact</h2>
          <p>
            Questions? Email us at <a href="mailto:kanmegnea@gmail.com">kanmegnea@gmail.com</a>.
          </p>
        </div>
      </div>
    </>
  );
}
