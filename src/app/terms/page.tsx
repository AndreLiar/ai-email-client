export const metadata = {
  title: 'Terms of Service — GetCleanInbox',
};

import Link from 'next/link';

export default function TermsPage() {
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

          <h1>Terms of Service</h1>
          <p className="legal-date">Last updated: April 19, 2026</p>

          <p>
            By using GetCleanInbox (&ldquo;the Service&rdquo;) at getcleaninbox.xyz, you agree to these Terms of Service.
            Please read them carefully.
          </p>

          <hr />

          <h2>1. Description of Service</h2>
          <p>
            GetCleanInbox is an AI-powered Gmail inbox cleaner that helps users identify, bulk-delete, and
            unsubscribe from unwanted emails. The Service requires you to connect your Google account and
            grant Gmail access permissions.
          </p>

          <h2>2. Eligibility</h2>
          <p>
            You must be at least 13 years old to use this Service. By using the Service, you represent that
            you meet this requirement and that all information you provide is accurate.
          </p>

          <h2>3. Your Gmail Data</h2>
          <ul>
            <li>You grant GetCleanInbox permission to access your Gmail account solely to provide the features you request.</li>
            <li>All actions (deletions, unsubscribes) require your explicit approval before execution.</li>
            <li>We do not access, store, or process email content beyond what is necessary to display scan results to you.</li>
            <li>You can revoke Gmail access at any time via your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Google Account settings</a>.</li>
          </ul>

          <h2>4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service to delete emails you do not own or have permission to manage.</li>
            <li>Attempt to reverse-engineer, scrape, or abuse the Service.</li>
            <li>Use the Service for any unlawful purpose.</li>
          </ul>

          <h2>5. Subscription and Billing</h2>
          <ul>
            <li>Some features require a paid subscription processed via Stripe.</li>
            <li>Subscriptions auto-renew until cancelled.</li>
            <li>You can cancel anytime; access continues until the end of the billing period.</li>
            <li>We do not offer refunds for partial billing periods.</li>
          </ul>

          <h2>6. Disclaimer of Warranties</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee that
            the Service will be uninterrupted, error-free, or that deleted emails can be recovered.
            Always review the list of emails before confirming bulk actions.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, GetCleanInbox shall not be liable for any indirect,
            incidental, or consequential damages arising from your use of the Service, including accidental
            deletion of emails.
          </p>

          <h2>8. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of the Service after changes constitutes
            acceptance of the updated Terms.
          </p>

          <h2>9. Contact</h2>
          <p>
            Questions? Email us at <a href="mailto:kanmegnea@gmail.com">kanmegnea@gmail.com</a>.
          </p>
        </div>
      </div>
    </>
  );
}
