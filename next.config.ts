import type { NextConfig } from "next";

/** Sandbox / tunnel hosts that are allowed to reach the dev server directly. */
const DEV_ORIGINS = ["*.e2b.app", "*.vercel.app", "localhost:3000", "127.0.0.1:3000"];

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: false,

  /**
   * Next.js blocks cross-origin dev requests by default. Previews are served
   * from a proxied host, so it has to be named explicitly or the app throws
   * "Blocked cross-origin request" in development.
   */
  allowedDevOrigins: DEV_ORIGINS,

  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        // Camera and microphone are required by the consult room, and by nothing else.
        value: "camera=(self), microphone=(self), geolocation=()",
      },
    ];

    /**
     * Frame protection is production-only on purpose. In development the app is
     * rendered inside the preview harness's iframe, and `X-Frame-Options` would
     * blank the screen there. A deployed build keeps the clickjacking defence,
     * which matters for an app holding prescriptions behind a session.
     */
    if (isProd) {
      security.push({ key: "X-Frame-Options", value: "SAMEORIGIN" });
      security.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      });
    }

    return [
      {
        // Health data must never sit in an intermediary cache.
        source: "/:path*",
        headers: security,
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
      {
        // The service worker must never be served stale.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
