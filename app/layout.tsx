import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PWARegister } from '@/components/PWARegister';

export const metadata: Metadata = {
  title: 'Inventaire — Gestion d\'inventaire professionnelle',
  description: 'Solution complète de gestion d\'inventaire et de chaîne d\'approvisionnement',
  manifest: '/manifest.webmanifest',
  applicationName: 'Inventaire',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Inventaire',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
              const t = localStorage.getItem('inv-theme');
              if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {}`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
