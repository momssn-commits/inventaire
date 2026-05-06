import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Évite le warning "multiple lockfiles detected" (parent dir contient un autre lockfile)
  outputFileTracingRoot: __dirname,
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
  // Headers de sécurité HTTP — conformité OWASP Top 10.
  // HSTS ajouté automatiquement quand l'app passera derrière un reverse-proxy HTTPS.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Camera autorisée (scanner codes-barres) ; micro/géoloc bloqués.
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), usb=(), payment=()',
          },
        ],
      },
      {
        // Endpoints API : CORS contrôlé + pas de cache.
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
};

export default nextConfig;
