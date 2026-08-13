import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@palitra/shared', '@palitra/api-client'],
};

export default config;
