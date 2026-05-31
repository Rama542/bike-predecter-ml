/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15: serverComponentsExternalPackages moved to top-level
  serverExternalPackages: [],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
  devIndicators: false,
  // Allow large CSV dataset uploads through the ML proxy route
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
    // Raise the body clone limit so 34MB+ CSV files pass through the /api/ml proxy.
    // Default is 10MB; route handlers use this same limit.
    middlewareClientMaxBodySize: "100mb",
  },
  // ML proxy is handled by app/api/ml/[...path]/route.ts (reads ML_API_URL at runtime)
};

module.exports = nextConfig;
