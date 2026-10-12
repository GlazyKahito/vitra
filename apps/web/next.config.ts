import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // A second build (e.g. a local production preview beside `next dev`) can use its own folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  // PGlite ships WASM + data files that must not be bundled by webpack.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Files read from disk at runtime that the tracer cannot see through static imports. Needed for the
  // temporary Vercel demo fallback (no DATABASE_URL): PGlite's WASM + data bundle, the SQL migrations and
  // the SYNTHETIC fixture strip PNGs used by the auto-seed. Harmless when DATABASE_URL is set.
  outputFileTracingIncludes: {
    "/**/*": [
      "./db/migrations/*.sql",
      "./db/fixtures/strips/*.png",
      "./node_modules/@electric-sql/pglite/dist/*.wasm",
      "./node_modules/@electric-sql/pglite/dist/*.data",
      "./node_modules/@electric-sql/pglite/dist/*.js",
      "./node_modules/@electric-sql/pglite/dist/*.cjs",
      "./node_modules/@electric-sql/pglite/dist/fs/*",
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
