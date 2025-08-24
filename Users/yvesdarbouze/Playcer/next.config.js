/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    // This allows the Next.js dev server to accept requests from the
    // Firebase Studio preview environment.
    allowedDevOrigins: ["*.cloudworkstations.dev"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

module.exports = nextConfig;
