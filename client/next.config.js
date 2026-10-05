/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the Express server serves client/out and mounts /api/* on the same origin.
  output: 'export',
  images: { unoptimized: true },
  // Emit routes as directories with index.html (e.g. /reports/ -> reports/index.html)
  // so a plain static file server can resolve extensionless URLs.
  trailingSlash: true,
  // Dev-only: proxy /api/* to the Express API so the browser stays same-origin (no CORS).
  // `rewrites` is not supported in `output: 'export'` builds, so it is only
  // registered when running `next dev` (NODE_ENV=development).
  ...(process.env.NODE_ENV === 'development'
    ? {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: 'http://localhost:4000/api/:path*',
            },
          ];
        },
      }
    : {}),
};

module.exports = nextConfig;
