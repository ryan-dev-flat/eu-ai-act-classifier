/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  async rewrites() {
    return [
      { source: '/api/classifications/:path*', destination: 'http://localhost:4001/v1/classifications/:path*' },
      { source: '/api/workflows/:path*',       destination: 'http://localhost:4002/v1/workflows/:path*' },
      { source: '/api/regulations/:path*',     destination: 'http://localhost:4003/v1/regulations/:path*' },
      { source: '/api/timeline/:path*',        destination: 'http://localhost:4004/v1/timeline/:path*' },
      { source: '/api/audit/:path*',           destination: 'http://localhost:4005/v1/audit/:path*' },
      { source: '/api/tenant/:path*',          destination: 'http://localhost:4007/v1/:path*' },
      { source: '/api/exports/:path*',         destination: 'http://localhost:4008/v1/exports/:path*' },
    ];
  },
};

export default nextConfig;
