const adminScriptPolicy = process.env.NODE_ENV === "production"
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

// Phase 8 security audit: public routes (/, /daftar, /tentang, ...) previously
// had none of these headers at all - only /admin* and /api/admin* did. The
// public site is fully self-contained (no third-party scripts/fonts/images),
// so the same strict CSP applies safely here too. Cache-Control is
// deliberately NOT forced to no-store on the baseline set so static/public
// pages keep normal caching; only the admin-specific set below adds no-store.
const baselineHeaders = [
  { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; ${adminScriptPolicy}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'` },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const adminHeaders = [
  ...baselineHeaders,
  { key: "Cache-Control", value: "no-store" },
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Phase 9: self-hosted Docker deployment (Contabo) copies only the
  // standalone output + static assets into the runtime image, not the
  // full node_modules tree - see Dockerfile and RUNBOOK.md §Deployment
  // readiness. Has no effect on `next dev`.
  output: "standalone",
  experimental: {
    typedEnv: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: baselineHeaders },
      { source: "/admin/:path*", headers: adminHeaders },
      { source: "/api/admin/:path*", headers: adminHeaders },
      { source: "/api/auth/:path*", headers: adminHeaders },
    ];
  },
};

export default nextConfig;
