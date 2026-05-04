import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'EU AI Act Risk Classifier',
  description: 'Classify, track, and report on EU AI Act compliance posture.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <main className="mx-auto max-w-7xl p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
