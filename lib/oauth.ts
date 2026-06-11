import { createHmac, randomBytes } from 'node:crypto';

/**
 * Minimal OAuth helpers for claude.ai custom connector compatibility.
 *
 * Flow: claude.ai redirects user to /oauth/authorize → we auto-approve and
 * redirect back with a signed auth code → claude.ai exchanges it at /oauth/token
 * → we return MCP_AUTH_TOKEN as the access_token (which our MCP endpoint already validates).
 *
 * Auth codes are HMAC-signed timestamps so they're verifiable without server-side
 * storage (important for serverless/Vercel where there's no shared memory).
 */

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function hmac(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/** Generate a signed authorization code. */
export function generateAuthCode(secret: string): string {
  const ts = Date.now().toString();
  const nonce = randomBytes(8).toString('hex');
  const payload = `${ts}:${nonce}`;
  const sig = hmac(payload, secret);
  // base64url so it's safe in query strings
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

/** Verify a signed authorization code. Returns true if valid and not expired. */
export function verifyAuthCode(code: string, secret: string): boolean {
  try {
    const decoded = Buffer.from(code, 'base64url').toString();
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [ts, nonce, sig] = parts;
    const payload = `${ts}:${nonce}`;
    if (hmac(payload, secret) !== sig) return false;
    const age = Date.now() - parseInt(ts, 10);
    return age >= 0 && age < CODE_TTL_MS;
  } catch {
    return false;
  }
}

/** The base URL of this server (from VERCEL_URL or fallback). */
export function serverUrl(): string {
  const host = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.SERVER_URL ?? 'https://edmingle-mcp.vercel.app';
  return host;
}
