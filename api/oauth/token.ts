import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyAuthCode } from '../../lib/oauth.js';

/**
 * OAuth Token Endpoint.
 *
 * Exchanges an authorization code for an access token.
 * The access token IS the MCP_AUTH_TOKEN — which our MCP endpoint already validates.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  const secret = process.env.MCP_AUTH_TOKEN;
  if (!secret) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'server_error' }));
    return;
  }

  // Parse body
  const body = await new Promise<string>((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });

  let params: URLSearchParams;
  try {
    // Token requests are typically application/x-www-form-urlencoded
    params = new URLSearchParams(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_request' }));
    return;
  }

  const grantType = params.get('grant_type');
  const code = params.get('code');

  if (grantType !== 'authorization_code' || !code) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unsupported_grant_type' }));
    return;
  }

  if (!verifyAuthCode(code, secret)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' }));
    return;
  }

  // Return the MCP_AUTH_TOKEN as the access token.
  // Our MCP endpoint already validates Bearer tokens against this same value.
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({
    access_token: secret,
    token_type: 'Bearer',
    expires_in: 86400,
  }));
}
