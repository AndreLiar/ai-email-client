import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@clerk/nextjs'],

  // ✅ Autorise les requêtes Stripe CLI et tests à la fois en local et via ngrok
  allowedDevOrigins: [
    'http://localhost:3000',
    //'https://24e6-2a02-8424-6ee0-be01-70b8-f4a5-730a-761e.ngrok-free.app'
  ],

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // ✅ Recommandé : clé renommée par Next.js
  serverExternalPackages: [],
};

export default nextConfig;
