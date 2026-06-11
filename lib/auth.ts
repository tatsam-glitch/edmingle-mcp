import { timingSafeEqual } from 'node:crypto';

export function verifyBearerToken(
  authHeader: string | undefined | null,
  expectedToken: string,
): boolean {
  if (!authHeader || !expectedToken) return false;
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) return false;
  const provided = match[1];
  const a = Buffer.from(provided);
  const b = Buffer.from(expectedToken);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}
