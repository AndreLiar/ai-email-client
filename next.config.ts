import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'http://localhost:3000',
  ],

  serverExternalPackages: [],

  transpilePackages: ['@clerk/nextjs', '@clerk/react', '@clerk/shared'],
};

export default nextConfig;
