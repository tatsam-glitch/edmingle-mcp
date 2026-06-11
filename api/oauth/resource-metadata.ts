import type { IncomingMessage, ServerResponse } from 'node:http';
import { serverUrl } from '../../lib/oauth.js';

/** RFC 9728 — OAuth Protected Resource Metadata */
export default function handler(_req: IncomingMessage, res: ServerResponse) {
  const base = serverUrl();
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({
    resource: base,
    authorization_servers: [base],
    bearer_methods_supported: ['header'],
  }));
}
