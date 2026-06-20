import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PWARegister } from '@/components/PWARegister';

export const metadata: Metadata = {
  title: 'Inventaire Pro',
  description: 'Solution complète de gestion d\'inventaire et de chaîne d\'approvisionnement',
  manifest: '/manifest.webmanifest',
  applicationName: 'Inventaire Pro',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Inventaire Pro',
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
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
