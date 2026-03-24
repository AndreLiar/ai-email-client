import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import { ReactNode } from 'react';
import { Space_Mono, Syne } from 'next/font/google';

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
});

const syne = Syne({
  weight: ['400', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

export const metadata = {
  title: 'CleanInbox AI',
  description: 'AI-powered inbox cleaner. Bulk unsubscribe and delete newsletters in one click.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-gramm="false" className={`${spaceMono.variable} ${syne.variable}`}>
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}
