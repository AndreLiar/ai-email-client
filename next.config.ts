import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'http://localhost:3000',
  ],

  serverExternalPackages: [],
};

export default nextConfig;
