import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * OAuth Dynamic Client Registration (RFC 7591).
 *
 * claude.ai may call this to register itself as a client.
 * We accept any registration and return a client_id (since auth
 * happens at the token level via MCP_AUTH_TOKEN, not client credentials).
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  const body = await new Promise<string>((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });

  let registration: Record<string, unknown>;
  try {
    registration = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_request' }));
    return;
  }

  // Accept the registration, return a client_id
  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    client_id: 'edmingle-connector',
    client_name: registration.client_name ?? 'Claude Connector',
    redirect_uris: registration.redirect_uris ?? [],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }));
}
