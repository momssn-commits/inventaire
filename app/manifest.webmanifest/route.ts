import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    name: 'Inventaire — Gestion professionnelle',
    short_name: 'Inventaire',
    description: 'Solution complète de gestion d\'inventaire et de chaîne d\'approvisionnement',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#2563eb',
    lang: 'fr-FR',
    orientation: 'any',
    categories: ['business', 'productivity', 'utilities'],
    icons: [
      { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
      { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
    shortcuts: [
      { name: 'Tableau de bord', url: '/dashboard' },
      { name: 'Mode entrepôt', url: '/codes-barres' },
      { name: 'Nouveau mouvement', url: '/operations/nouveau' },
    ],
  });
}
