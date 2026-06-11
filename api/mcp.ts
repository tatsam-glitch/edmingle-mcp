import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { verifyBearerToken } from '../lib/auth.js';
import { createMcpServer } from '../lib/server.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // --- Auth ---
  const authToken = process.env.MCP_AUTH_TOKEN;
  if (!authToken) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server misconfigured: MCP_AUTH_TOKEN not set' }));
    return;
  }

  const authHeader = req.headers.authorization as string | undefined;
  if (!verifyBearerToken(authHeader, authToken)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // --- MCP ---
  const { server } = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });

  await server.connect(transport);
  await transport.handleRequest(req, res);
}
