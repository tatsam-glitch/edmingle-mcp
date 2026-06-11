# Edmingle MCP Remote Server — Design

**Date:** 2026-06-11
**Status:** Approved, pending implementation
**Owner:** tatsam@taivas.co.in

## Goal

A Vercel-hosted remote MCP server that exposes the full Edmingle LMS/CRM (223 endpoints)
to teammates via their Claude Desktop apps. Separate project from the existing local
edmingle-mcp; reuses its core logic wholesale.

## Context

The local edmingle-mcp (at `~/Desktop/Dev Projects/edmingle-mcp/`) is built, tested, and
live on the Taivas Debate Club Edmingle account. It uses stdio transport for Claude Code.
This project wraps the same core in a Vercel-deployable HTTP service using the MCP
Streamable HTTP transport so 2-5 teammates can connect from Claude Desktop.

## Architecture

```
Claude Desktop (teammate)
  → HTTPS POST https://<app>.vercel.app/api/mcp
  → Bearer token auth checked
  → StreamableHTTPServerTransport (MCP SDK v1.29.0)
  → McpServer with same 23 tools (4 gateway + 19 named)
  → EdmingleClient → Edmingle REST API
  → Response streamed back
```

### What's reused from edmingle-mcp (copied, not linked)

Six source files from `edmingle-mcp/src/core/` and `edmingle-mcp/src/tools/`:

- `core/types.ts` — CatalogEntry, BodyMode, HttpMethod
- `core/destructive.ts` — isDestructive classifier
- `core/config.ts` — env loader (EdmingleConfig)
- `core/catalog.ts` — Catalog class (load, get, search, sections)
- `core/client.ts` — EdmingleClient (buildRequest, call, retry, safety)
- `tools/format.ts` — compact output formatter (80KB cap)
- `tools/gateway.ts` — 4 gateway tools + registration
- `tools/named.ts` — 19 named convenience tools + registration

Plus `catalog.json` (the generated 223-endpoint index).

These are copied once. If the local version evolves, re-copy. No monorepo, no npm link,
no shared dependency — simplest possible approach for two related but independent projects.

### What's new

- `api/mcp.ts` — single Vercel serverless function. Handles POST and GET at `/api/mcp`.
  Creates a `StreamableHTTPServerTransport` (stateless mode — no session management needed
  for a small team), wires it to an `McpServer` with all tools registered, and delegates
  the request. Each invocation is independent (serverless).
- `lib/auth.ts` — reads `Authorization: Bearer <token>` from the request, compares against
  `MCP_AUTH_TOKEN` env var using constant-time comparison. Returns 401 on mismatch.
- `lib/server.ts` — factory that creates and configures the McpServer with catalog + client
  + all tools. Called per-request (serverless = no persistent state).

## Auth

Single shared bearer token stored in Vercel env var `MCP_AUTH_TOKEN`.

- Every HTTP request must include `Authorization: Bearer <token>`.
- Constant-time string comparison to prevent timing attacks.
- 401 Unauthorized on mismatch (before any MCP processing).
- Token is generated once (random 64-char hex), shared with teammates out-of-band.
- Rotatable anytime by changing the Vercel env var + telling teammates.

No OAuth, no user database, no sessions. Appropriate for 2-5 trusted teammates.

## Teammate setup

Each person adds to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "edmingle": {
      "url": "https://edmingle-mcp-remote.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <the-shared-token>"
      }
    }
  }
}
```

Restart Claude Desktop. Done.

## Project structure

```
edmingle-mcp-remote/
  .gitignore
  package.json
  tsconfig.json
  vercel.json
  catalog.json                  # copied from edmingle-mcp
  .env.local                    # local dev (gitignored)
  api/
    mcp.ts                      # Vercel function entry point
  lib/
    auth.ts                     # bearer token check
    server.ts                   # McpServer factory (registers all tools)
    core/                       # copied from edmingle-mcp/src/core/
      types.ts
      destructive.ts
      config.ts
      catalog.ts
      client.ts
    tools/                      # copied from edmingle-mcp/src/tools/
      format.ts
      gateway.ts
      named.ts
```

## Environment variables (Vercel)

Required:
- `EDMINGLE_API_URL` — `https://taivasdebateclub-api.edmingle.com/nuSource/api/v1`
- `EDMINGLE_APIKEY` — the 32-char API key
- `EDMINGLE_ORGID` — `12314`
- `EDMINGLE_INSTITUTION_ID` — `9939`
- `MCP_AUTH_TOKEN` — shared bearer token for teammate auth

Optional:
- `EDMINGLE_ORGANIZATION_ID` — `12314`
- `EDMINGLE_HOST_NAME` — `www.taivas.co.in`
- `EDMINGLE_READ_ONLY` — `true` to disable writes (not set by default)

## Vercel config

```json
{
  "functions": {
    "api/mcp.ts": {
      "maxDuration": 60
    }
  }
}
```

60s max duration is plenty for any single Edmingle API call (most return in <2s).

## Safety

- Same destructive-confirm / dryRun / read-only model as local version.
- Claude Desktop still prompts users before each tool call.
- Bearer token prevents unauthorized access.
- HTTPS in transit (Vercel default).
- No Edmingle credentials exposed to teammates — they auth to our server, our server
  auths to Edmingle. Teammates never see the Edmingle API key.

## Cost

Vercel Hobby (free): 100GB bandwidth, 100K invocations/month. A 2-5 person team doing
Edmingle lookups uses a tiny fraction. **$0/month.**

## Limitations

- Serverless cold starts (~1-2s on first request after idle). Acceptable.
- No persistent MCP sessions (stateless mode). Each tool call is independent. Fine for
  this use case — tools are single request/response, no multi-turn server state needed.
- File upload endpoints remain unsupported (same as local v1).
- If local edmingle-mcp core evolves, files must be manually re-copied.

## Testing

- Unit tests for auth middleware (valid token, invalid token, missing token, timing-safe).
- Integration test: boot the server handler, send a mock MCP initialize + tools/list,
  verify 23 tools returned.
- Live smoke: after deploy, `curl` the endpoint with the token and verify MCP response.
