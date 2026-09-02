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
  poweredByHeader: false
};

export default nextConfig;
