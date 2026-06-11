# Edmingle MCP Remote Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Vercel-hosted remote MCP server exposing all 223 Edmingle endpoints to teammates via Claude Desktop, using Streamable HTTP transport and bearer token auth.

**Architecture:** Copy the 8 core source files + catalog.json from the local edmingle-mcp project. Add a single Vercel API route (`api/mcp.ts`) that checks a bearer token, creates a `StreamableHTTPServerTransport` (stateless), wires it to an `McpServer` with all 23 tools, and handles the request. Each invocation is independent (serverless).

**Tech Stack:** TypeScript (ESM, Node 20+), `@modelcontextprotocol/sdk` v1.29+ (StreamableHTTPServerTransport), `zod`, Vercel serverless functions, Vitest.

---

## File Structure

```
edmingle-mcp-remote/
  .gitignore                        # already created
  package.json
  tsconfig.json
  vercel.json
  vitest.config.ts
  catalog.json                      # copied from edmingle-mcp
  .env.local                        # local dev (gitignored)
  api/
    mcp.ts                          # Vercel function: auth + Streamable HTTP
  lib/
    auth.ts                         # bearer token verification
    server.ts                       # McpServer factory
    core/                           # copied verbatim from edmingle-mcp/src/core/
      types.ts
      destructive.ts
      config.ts
      catalog.ts
      client.ts
    tools/                          # copied verbatim from edmingle-mcp/src/tools/
      format.ts
      gateway.ts
      named.ts
  test/
    auth.test.ts
    server.test.ts
    integration.test.ts
```

---

## Task 1: Project scaffold + copy core files

**Files:**
- Create: `package.json`, `tsconfig.json`, `vercel.json`, `vitest.config.ts`, `.env.local`
- Copy: `catalog.json`, all `lib/core/*.ts`, all `lib/tools/*.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "edmingle-mcp-remote",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "dev": "vercel dev"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vercel": "^41.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["api/**/*.ts", "lib/**/*.ts"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create `vercel.json`**

```json
{
  "functions": {
    "api/mcp.ts": {
      "maxDuration": 60
    }
  }
}
```

- [ ] **Step 5: Create `.env.local`**

```bash
EDMINGLE_API_URL=https://taivasdebateclub-api.edmingle.com/nuSource/api/v1
EDMINGLE_APIKEY=PASTE_YOUR_KEY_HERE
EDMINGLE_ORGID=12314
EDMINGLE_INSTITUTION_ID=9939
EDMINGLE_ORGANIZATION_ID=12314
EDMINGLE_HOST_NAME=www.taivas.co.in
MCP_AUTH_TOKEN=dev-test-token-replace-before-deploy
```

- [ ] **Step 6: Copy `catalog.json` from edmingle-mcp**

Run:
```bash
cp "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp/catalog.json" "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp-remote/catalog.json"
```

- [ ] **Step 7: Copy core source files from edmingle-mcp**

Run:
```bash
cd "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp-remote"
mkdir -p lib/core lib/tools
cp "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp/src/core/types.ts" lib/core/types.ts
cp "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp/src/core/destructive.ts" lib/core/destructive.ts
cp "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp/src/core/config.ts" lib/core/config.ts
cp "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp/src/core/catalog.ts" lib/core/catalog.ts
cp "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp/src/core/client.ts" lib/core/client.ts
cp "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp/src/tools/format.ts" lib/tools/format.ts
cp "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp/src/tools/gateway.ts" lib/tools/gateway.ts
cp "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp/src/tools/named.ts" lib/tools/named.ts
```

- [ ] **Step 8: Fix import paths in copied files**

The copied files use `../core/` imports (relative to `src/tools/`). In the new layout they're at `lib/tools/` importing from `lib/core/`, so the relative paths are the same (`../core/`). Verify no breakage:

Run: `npx tsc --noEmit`
Expected: no errors (after npm install in next step).

- [ ] **Step 9: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 10: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no type errors. If `catalog.ts` uses `readFileSync` with a URL arg and TS complains, change the `Catalog.load()` call in `lib/server.ts` (Task 3) to pass an explicit path string instead.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold edmingle-mcp-remote with copied core files"
```

---

## Task 2: Auth middleware

**Files:**
- Create: `lib/auth.ts`
- Test: `test/auth.test.ts`

- [ ] **Step 1: Write the failing test `test/auth.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { verifyBearerToken } from '../lib/auth.js';

describe('verifyBearerToken', () => {
  it('returns true for a valid token', () => {
    expect(verifyBearerToken('Bearer secret123', 'secret123')).toBe(true);
  });

  it('returns false for an invalid token', () => {
    expect(verifyBearerToken('Bearer wrong', 'secret123')).toBe(false);
  });

  it('returns false for missing Authorization header', () => {
    expect(verifyBearerToken(undefined, 'secret123')).toBe(false);
    expect(verifyBearerToken('', 'secret123')).toBe(false);
  });

  it('returns false for non-Bearer scheme', () => {
    expect(verifyBearerToken('Basic abc123', 'secret123')).toBe(false);
  });

  it('returns false when expected token is empty', () => {
    expect(verifyBearerToken('Bearer anything', '')).toBe(false);
  });

  it('is timing-safe (same length comparison)', () => {
    // We can't easily test timing, but we verify it doesn't throw on length mismatch
    expect(verifyBearerToken('Bearer short', 'a-much-longer-expected-token')).toBe(false);
    expect(verifyBearerToken('Bearer a-much-longer-provided-token', 'short')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/auth.test.ts`
Expected: FAIL — cannot find module `../lib/auth.js`.

- [ ] **Step 3: Create `lib/auth.ts`**

```ts
import { timingSafeEqual } from 'node:crypto';

/**
 * Verify a Bearer token from an Authorization header against an expected value.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyBearerToken(
  authHeader: string | undefined | null,
  expectedToken: string,
): boolean {
  if (!authHeader || !expectedToken) return false;

  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) return false;

  const provided = match[1];

  // timingSafeEqual requires equal-length buffers; pad the shorter one
  const a = Buffer.from(provided);
  const b = Buffer.from(expectedToken);
  if (a.length !== b.length) {
    // Compare against itself to burn the same time, then return false
    timingSafeEqual(a, a);
    return false;
  }

  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/auth.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts test/auth.test.ts
git commit -m "feat: bearer token auth middleware"
```

---

## Task 3: McpServer factory

**Files:**
- Create: `lib/server.ts`
- Test: `test/server.test.ts`

- [ ] **Step 1: Write the failing test `test/server.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../lib/server.js';

describe('createMcpServer', () => {
  it('creates a server and returns it', () => {
    const { server } = createMcpServer();
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/server.test.ts`
Expected: FAIL — cannot find module `../lib/server.js`.

- [ ] **Step 3: Create `lib/server.ts`**

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfig } from './core/config.js';
import { Catalog } from './core/catalog.js';
import { EdmingleClient } from './core/client.js';
import { registerGatewayTools, type ToolCtx } from './tools/gateway.js';
import { registerNamedTools } from './tools/named.js';

/**
 * Create a fully configured McpServer with all Edmingle tools registered.
 * Called per-request in the serverless function (no persistent state).
 */
export function createMcpServer(): { server: McpServer; toolCount: number } {
  const config = loadConfig();
  const catalog = Catalog.load();
  const client = new EdmingleClient(config);
  const ctx: ToolCtx = { catalog, client };

  const server = new McpServer({ name: 'edmingle-mcp-remote', version: '0.1.0' });
  registerGatewayTools(server, ctx);
  registerNamedTools(server, ctx);

  return { server, toolCount: catalog.all().length };
}
```

Note: `Catalog.load()` uses `readFileSync` with a URL relative to `import.meta.url`. In this layout, from `lib/server.ts`, `catalog.json` is at `../../catalog.json` (relative to `lib/`). The existing `Catalog.load()` default path is `new URL('../../catalog.json', import.meta.url)`. From `lib/server.ts` that resolves to the project root — correct. If it doesn't resolve (e.g. Vercel bundles differently), pass an explicit path:

```ts
import { resolve } from 'node:path';
const catalogPath = new URL('../../catalog.json', import.meta.url);
const catalog = Catalog.load(catalogPath);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/server.test.ts`
Expected: PASS. If it fails because `loadConfig()` reads `process.env` and the required vars are missing, set them in the test:

```ts
import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.EDMINGLE_API_URL = 'https://test.example.com/v1';
  process.env.EDMINGLE_APIKEY = 'test-key';
  process.env.EDMINGLE_ORGID = '1';
  process.env.EDMINGLE_INSTITUTION_ID = '1';
});
```

Add this to the top of the test file if needed.

- [ ] **Step 5: Commit**

```bash
git add lib/server.ts test/server.test.ts
git commit -m "feat: McpServer factory with all Edmingle tools"
```

---

## Task 4: Vercel API route

**Files:**
- Create: `api/mcp.ts`

- [ ] **Step 1: Create `api/mcp.ts`**

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add api/mcp.ts
git commit -m "feat: Vercel API route with auth + Streamable HTTP transport"
```

---

## Task 5: Integration test

**Files:**
- Create: `test/integration.test.ts`

- [ ] **Step 1: Write the integration test**

This test creates the McpServer, connects it to a StreamableHTTPServerTransport, and simulates an MCP `initialize` + `tools/list` flow using Node's `http.createServer`.

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../lib/server.js';

beforeAll(() => {
  process.env.EDMINGLE_API_URL = 'https://test.example.com/v1';
  process.env.EDMINGLE_APIKEY = 'test-key';
  process.env.EDMINGLE_ORGID = '1';
  process.env.EDMINGLE_INSTITUTION_ID = '1';
});

function post(port: number, body: unknown): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/', method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Accept: 'application/json, text/event-stream',
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: buf }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

describe('MCP Streamable HTTP integration', () => {
  let httpServer: http.Server;
  let port: number;

  beforeAll(async () => {
    httpServer = http.createServer(async (req, res) => {
      const { server } = createMcpServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(() => {
    httpServer.close();
  });

  it('responds to initialize + tools/list and returns 23 tools', async () => {
    // Step 1: Initialize
    const initRes = await post(port, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '0.1.0' },
      },
    });
    expect(initRes.status).toBe(200);

    // Parse — may be SSE or JSON
    let initData: any;
    if (initRes.body.startsWith('{')) {
      initData = JSON.parse(initRes.body);
    } else {
      // SSE: extract the data lines
      const lines = initRes.body.split('\n').filter((l) => l.startsWith('data: '));
      const jsonLine = lines.find((l) => l.includes('"result"'));
      expect(jsonLine).toBeTruthy();
      initData = JSON.parse(jsonLine!.slice(6));
    }
    expect(initData.result?.serverInfo?.name).toBe('edmingle-mcp-remote');

    // Step 2: Send initialized notification
    await post(port, { jsonrpc: '2.0', method: 'notifications/initialized' });

    // Step 3: List tools
    const toolsRes = await post(port, {
      jsonrpc: '2.0', id: 2, method: 'tools/list', params: {},
    });
    expect(toolsRes.status).toBe(200);

    let toolsData: any;
    if (toolsRes.body.startsWith('{')) {
      toolsData = JSON.parse(toolsRes.body);
    } else {
      const lines = toolsRes.body.split('\n').filter((l) => l.startsWith('data: '));
      const jsonLine = lines.find((l) => l.includes('"tools"'));
      expect(jsonLine).toBeTruthy();
      toolsData = JSON.parse(jsonLine!.slice(6));
    }

    const tools = toolsData.result?.tools ?? [];
    expect(tools.length).toBe(23);
    expect(tools.some((t: any) => t.name === 'edmingle_call')).toBe(true);
    expect(tools.some((t: any) => t.name === 'edmingle_students_list')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npx vitest run test/integration.test.ts`
Expected: PASS (1 test). If it fails, debug the SSE response parsing — the test handles both JSON and SSE response formats.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all test files PASS.

- [ ] **Step 4: Commit**

```bash
git add test/integration.test.ts
git commit -m "test: integration test — initialize + tools/list returns 23 tools"
```

---

## Task 6: Deploy to Vercel and verify

**Files:**
- No new files. Deploy + configure env vars.

- [ ] **Step 1: Copy the real API key into `.env.local`**

Read the apikey from the local edmingle-mcp `.env` and write it into this project's `.env.local`:

Run:
```bash
cd "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp-remote"
APIKEY=$(grep EDMINGLE_APIKEY "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp/.env" | cut -d= -f2)
sed -i '' "s/PASTE_YOUR_KEY_HERE/$APIKEY/" .env.local
```

- [ ] **Step 2: Generate a secure auth token**

Run:
```bash
TOKEN=$(openssl rand -hex 32)
echo "Generated MCP_AUTH_TOKEN: $TOKEN"
sed -i '' "s/dev-test-token-replace-before-deploy/$TOKEN/" .env.local
```

Save this token — teammates will need it.

- [ ] **Step 3: Deploy to Vercel**

Run:
```bash
cd "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp-remote"
npx vercel --yes
```

Follow any prompts to link to a new project. After deployment, note the preview URL.

- [ ] **Step 4: Set environment variables on Vercel**

Run:
```bash
npx vercel env add EDMINGLE_API_URL production <<< "https://taivasdebateclub-api.edmingle.com/nuSource/api/v1"
npx vercel env add EDMINGLE_APIKEY production <<< "<paste-real-key>"
npx vercel env add EDMINGLE_ORGID production <<< "12314"
npx vercel env add EDMINGLE_INSTITUTION_ID production <<< "9939"
npx vercel env add EDMINGLE_ORGANIZATION_ID production <<< "12314"
npx vercel env add EDMINGLE_HOST_NAME production <<< "www.taivas.co.in"
npx vercel env add MCP_AUTH_TOKEN production <<< "<paste-generated-token>"
```

- [ ] **Step 5: Deploy to production**

Run:
```bash
npx vercel --prod
```

Note the production URL (e.g. `https://edmingle-mcp-remote.vercel.app`).

- [ ] **Step 6: Smoke test the live deployment**

Run:
```bash
TOKEN="<paste-generated-token>"
URL="https://edmingle-mcp-remote.vercel.app/api/mcp"

# Test auth rejection
curl -s -o /dev/null -w "%{http_code}" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}'

# Should print: 401

# Test with valid token
curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}'

# Should return JSON-RPC response with serverInfo.name = "edmingle-mcp-remote"
```

- [ ] **Step 7: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "chore: verified live deployment"
```

---

## Task 7: Document teammate setup

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
# edmingle-mcp-remote

Remote MCP server for the Taivas Edmingle LMS/CRM. Hosted on Vercel, connects to
Claude Desktop via Streamable HTTP transport.

Exposes all 223 Edmingle API endpoints (4 gateway tools + 19 named convenience tools).

## For Teammates — Setup

1. Open Claude Desktop settings → Developer → Edit Config
   (or edit `~/Library/Application Support/Claude/claude_desktop_config.json` directly)

2. Add this inside the `"mcpServers"` object:

```json
"edmingle": {
  "url": "https://edmingle-mcp-remote.vercel.app/api/mcp",
  "headers": {
    "Authorization": "Bearer ASK_TATSAM_FOR_THE_TOKEN"
  }
}
```

3. Get the token from Tatsam and replace `ASK_TATSAM_FOR_THE_TOKEN`.

4. Restart Claude Desktop.

5. You should now see Edmingle tools available. Try: "List all Edmingle students".

## For Admin (Tatsam)

### Rotate the auth token

```bash
NEW_TOKEN=$(openssl rand -hex 32)
npx vercel env rm MCP_AUTH_TOKEN production
npx vercel env add MCP_AUTH_TOKEN production <<< "$NEW_TOKEN"
npx vercel --prod
```

Then share the new token with teammates.

### Update after Edmingle API changes

1. Re-export the Postman collection in the local edmingle-mcp project
2. Run `npm run gen:catalog` there
3. Copy `catalog.json` here: `cp ../edmingle-mcp/catalog.json .`
4. Copy updated core files if changed: `cp ../edmingle-mcp/src/core/*.ts lib/core/ && cp ../edmingle-mcp/src/tools/*.ts lib/tools/`
5. `npm test` to verify
6. `npx vercel --prod` to redeploy

### Environment variables (Vercel)

| Variable | Value | Required |
|----------|-------|----------|
| EDMINGLE_API_URL | `https://taivasdebateclub-api.edmingle.com/nuSource/api/v1` | yes |
| EDMINGLE_APIKEY | (secret) | yes |
| EDMINGLE_ORGID | `12314` | yes |
| EDMINGLE_INSTITUTION_ID | `9939` | yes |
| EDMINGLE_ORGANIZATION_ID | `12314` | no |
| EDMINGLE_HOST_NAME | `www.taivas.co.in` | no |
| MCP_AUTH_TOKEN | (secret) | yes |

## Safety

- Destructive endpoints require `confirm:true` (Claude Desktop prompts users)
- `EDMINGLE_READ_ONLY=true` disables all write tools
- Bearer token auth on every request
- Teammates never see the Edmingle API key
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: teammate setup + admin instructions"
```
