/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep the real @vercel/og package at runtime; Next's aliased copy crashes on Windows.
    serverComponentsExternalPackages: ["@prisma/client", "@upstash/redis", "@vercel/og"],
  },
};

export default nextConfig;
