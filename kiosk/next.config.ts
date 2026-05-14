import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin Turbopack root to this app. If a parent folder (e.g. $HOME) has a
// package-lock.json, Next may otherwise pick the wrong root and break `@/*`.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** Express + Socket.IO server (default matches backend/server.js). */
const kioskBackendOrigin =
  process.env.KIOSK_BACKEND_ORIGIN?.replace(/\/+$/, "") || "http://127.0.0.1:3000";

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${kioskBackendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
