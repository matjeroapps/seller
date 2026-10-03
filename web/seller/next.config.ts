import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  poweredByHeader: false,
  transpilePackages: ['@matjerhub/ui-sdk'],
  async rewrites() {
    // Feature 025 canonical route carriage: store screens keep their single
    // implementation under /dashboard/stores/{store_id}; the canonical
    // Merchant Console paths serve the same components through a URL-preserving
    // rewrite. Screen implementations are never duplicated, and every data
    // request remains protected by server-side authorization regardless of the
    // URL shape.
    return [
      {
        source: '/dashboard/merchants/:merchantId/stores/:storeId/:path*',
        destination: '/dashboard/stores/:storeId/:path*'
      },
      {
        source: '/dashboard/merchants/:merchantId/stores/:storeId',
        destination: '/dashboard/stores/:storeId'
      }
    ];
  }
};

export default nextConfig;
