/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Baseline response headers. The live deployment terminates plain HTTP on
  // the LAN today; HSTS is inert until TLS is in front of the app and the
  // rest are safe either way. CSP is deliberately left out until the inline
  // scripts Next streams get nonces — a naive policy breaks the app.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  // `/events` is a natural URL to type, but the event browser lives on the
  // homepage. A config redirect is a real 307; a page-level redirect() streams
  // a 200 with a meta refresh instead.
  async redirects() {
    return [{ source: "/events", destination: "/", permanent: false }];
  },
  // The Docker build sets NEXT_OUTPUT_STANDALONE=1 to produce the
  // self-contained .next/standalone bundle. Local builds keep the default
  // output so `next start` (and the verify harnesses) work unchanged.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1"
    ? { output: "standalone" }
    : {}),
};
export default nextConfig;
