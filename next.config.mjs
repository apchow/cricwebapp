/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

/**
 * No nonce pipeline here (that needs a proxy), so inline script/style stay
 * allowed: the App Router ships its RSC payload and Tailwind/font styles inline.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // next/font self-hosts, but keep the Google hosts so a runtime fallback works.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig = {
  experimental: {
    // Icons and motion are pulled in as deep ESM paths so no barrel file is
    // shipped to the browser bundle.
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  // The Postgres driver opens sockets and reads its own package files; let it
  // stay external instead of being bundled into the serverless function.
  serverExternalPackages: ["postgres"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
