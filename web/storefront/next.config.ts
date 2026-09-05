import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A self-contained server bundle, so the production image needs no node_modules
  // install and no source tree at runtime.
  output: 'standalone',
  // The workspace root is two levels up; without this, output file tracing starts from
  // this directory and misses the hoisted dependencies.
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  typedRoutes: true,
  // The build must not disclose the framework version to a customer.
  poweredByHeader: false,
  async rewrites() {
    const apiBaseUrl = (process.env.STOREFRONT_API_BASE_URL || 'http://127.0.0.1:8080').trim();
    return [
      {
        source: '/v1/storefront/:path*',
        destination: `${apiBaseUrl}/v1/storefront/:path*`
      }
    ];
  }
};

export default nextConfig;
