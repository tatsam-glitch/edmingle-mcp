import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { verifyBearerToken } from '../lib/auth.js';
import { createMcpServer } from '../lib/server.js';
import { serverUrl } from '../lib/oauth.js';

export const config = { supportsResponseStreaming: false };

function authCheck(req: Request): Response | null {
  const authToken = process.env.MCP_AUTH_TOKEN;
  if (!authToken) {
    return Response.json({ error: 'Server misconfigured: MCP_AUTH_TOKEN not set' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') ?? undefined;
  const url = new URL(req.url);
  const urlToken = url.searchParams.get('token');
  const authenticated =
    verifyBearerToken(authHeader, authToken) ||
    (!!urlToken && verifyBearerToken(`Bearer ${urlToken}`, authToken));

  if (!authenticated) {
    const base = serverUrl();
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      },
    });
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  const denied = authCheck(req);
  if (denied) return denied;

  const { server } = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function GET(req: Request): Promise<Response> {
  const denied = authCheck(req);
  if (denied) return denied;

  // GET for SSE listening — return 405 in serverless
  return new Response(null, { status: 405 });
}

export async function DELETE(): Promise<Response> {
  return new Response(null, { status: 405 });
}
