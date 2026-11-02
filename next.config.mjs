/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Icons and motion are pulled in as deep ESM paths so no barrel file is
    // shipped to the browser bundle.
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
