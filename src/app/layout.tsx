// app/layout.tsx
// app/layout.tsx
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';

export const metadata = {
  title: 'AI Email Client',
  description: 'Client email intelligent propulsé par l’IA locale',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider proxyUrl={process.env.NEXT_PUBLIC_CLERK_PROXY_URL}>
      <html lang="en" data-gramm="false">
        <body>
          <main className="container py-5">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
