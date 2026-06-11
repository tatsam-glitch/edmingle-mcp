import type { IncomingMessage, ServerResponse } from 'node:http';
import { serverUrl } from '../../lib/oauth.js';

/** RFC 8414 — OAuth Authorization Server Metadata */
export default function handler(_req: IncomingMessage, res: ServerResponse) {
  const base = serverUrl();
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'],
  }));
}
