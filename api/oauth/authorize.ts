import type { IncomingMessage, ServerResponse } from 'node:http';
import { generateAuthCode } from '../../lib/oauth.js';

/**
 * OAuth Authorization Endpoint.
 *
 * claude.ai redirects users here. Since our server has no user accounts
 * (it's a shared team tool), we auto-approve and redirect back with a
 * signed auth code. The code is verified at the token endpoint.
 */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const redirectUri = url.searchParams.get('redirect_uri');
  const state = url.searchParams.get('state');

  if (!redirectUri) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'missing redirect_uri' }));
    return;
  }

  const secret = process.env.MCP_AUTH_TOKEN;
  if (!secret) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'server misconfigured' }));
    return;
  }

  const code = generateAuthCode(secret);

  // Build the redirect URL with the code
  const redirect = new URL(redirectUri);
  redirect.searchParams.set('code', code);
  if (state) redirect.searchParams.set('state', state);

  res.writeHead(302, { Location: redirect.toString() });
  res.end();
}
