import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function SignInPage() {
  return (
    <>
      <style>{`
        .auth-root {
          background: #06090f;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem 1.5rem;
          position: relative;
          overflow: hidden;
        }
        .auth-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(0,217,126,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,217,126,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        .auth-logo {
          font-family: var(--font-space-mono), monospace;
          font-size: 1rem;
          color: #00d97e;
          text-decoration: none;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
          position: relative;
        }
        .auth-logo span { color: #c8d8cc; }
        .auth-tagline {
          font-family: var(--font-space-mono), monospace;
          font-size: 0.65rem;
          letter-spacing: 0.18em;
          color: #4a6a54;
          text-transform: uppercase;
          margin-bottom: 2rem;
          position: relative;
        }
        .auth-card-wrap {
          position: relative;
          width: 100%;
          max-width: 420px;
        }
      `}</style>

      <div className="auth-root">
        <Link href="/" className="auth-logo">
          get<span>cleaninbox</span>.xyz
        </Link>
        <p className="auth-tagline">// AI-powered Gmail cleaner</p>

        <div className="auth-card-wrap">
          <SignIn
            appearance={{
              variables: {
                colorBackground: '#0b1018',
                colorText: '#c8d8cc',
                colorPrimary: '#00d97e',
                colorInputBackground: '#06090f',
                colorInputText: '#c8d8cc',
                colorInputPlaceholder: '#4a6a54',
                colorTextSecondary: '#7a9a84',
                colorDanger: '#ff6b6b',
                fontFamily: 'var(--font-space-mono), monospace',
                borderRadius: '4px',
              },
              elements: {
                card: {
                  border: '1px solid rgba(0,217,126,0.15)',
                  boxShadow: '0 0 60px rgba(0,217,126,0.06), 0 20px 60px rgba(0,0,0,0.5)',
                  background: '#0b1018',
                },
                headerTitle: {
                  color: '#f0f7f2',
                  fontSize: '1.1rem',
                  fontFamily: 'var(--font-syne), sans-serif',
                  fontWeight: '700',
                },
                headerSubtitle: { color: '#7a9a84', fontSize: '0.8rem' },
                socialButtonsBlockButton: {
                  border: '1px solid rgba(0,217,126,0.2)',
                  background: 'transparent',
                  color: '#c8d8cc',
                },
                socialButtonsBlockButton__google: {
                  border: '1px solid rgba(0,217,126,0.25)',
                },
                dividerLine: { background: 'rgba(0,217,126,0.1)' },
                dividerText: { color: '#4a6a54' },
                formFieldLabel: { color: '#7a9a84', fontSize: '0.7rem', letterSpacing: '0.1em' },
                formFieldInput: {
                  background: '#06090f',
                  border: '1px solid rgba(0,217,126,0.15)',
                  color: '#c8d8cc',
                },
                formButtonPrimary: {
                  background: '#00d97e',
                  color: '#06090f',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  fontSize: '0.8rem',
                },
                footerActionLink: { color: '#00d97e' },
                identityPreviewText: { color: '#c8d8cc' },
                identityPreviewEditButton: { color: '#00d97e' },
              },
            }}
          />
        </div>
      </div>
    </>
  );
}
