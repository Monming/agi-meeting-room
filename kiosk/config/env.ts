function normalizeApiRoot(raw: string | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return t.replace(/\/+$/, '');
}

/**
 * When `NEXT_PUBLIC_API_URL` is unset, REST calls use same-origin `/api/*`.
 * `next.config` rewrites that to the Express app (see `KIOSK_BACKEND_ORIGIN`).
 * This avoids the common bug where both Next and the API default to port 3000.
 */
export const env = {
  /** Absolute API root ending in `/api`, or `null` for same-origin `/api`. */
  apiRoot: normalizeApiRoot(process.env.NEXT_PUBLIC_API_URL),
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000',
  isMockMode: process.env.NEXT_PUBLIC_MOCK_MODE === 'true',
};
