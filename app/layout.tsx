import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { PWARegister } from '@/components/PWARegister';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans', display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap' });

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
    <html lang="fr" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head />
      <body className="min-h-screen antialiased">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
