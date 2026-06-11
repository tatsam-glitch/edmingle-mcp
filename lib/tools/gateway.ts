import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Catalog } from '../core/catalog.js';
import type { EdmingleClient, CallResult } from '../core/client.js';
import type { CatalogEntry } from '../core/types.js';
import { formatResult } from './format.js';

export interface ToolCtx { catalog: Catalog; client: EdmingleClient; }

function summarize(e: CatalogEntry) {
  return { id: e.id, name: e.name, section: e.section, method: e.method, destructive: e.destructive };
}

export function gatewayHandlers(ctx: ToolCtx) {
  return {
    listSections() {
      return { sections: ctx.catalog.sections() };
    },
    searchEndpoints(args: { query: string }) {
      return { results: ctx.catalog.search(args.query).map(summarize) };
    },
    describeEndpoint(args: { id: string }): { endpoint?: CatalogEntry; error?: string } {
      const e = ctx.catalog.get(args.id);
      if (!e) return { error: `Endpoint "${args.id}" not found. Use edmingle_search_endpoints first.` };
      return { endpoint: e };
    },
    async callEndpoint(args: {
      id: string;
      pathParams?: Record<string, string | number>;
      query?: Record<string, string | number | boolean>;
      body?: unknown;
      confirm?: boolean;
      dryRun?: boolean;
    }): Promise<CallResult> {
      const e = ctx.catalog.get(args.id);
      if (!e) return { ok: false, message: `Endpoint "${args.id}" not found. Use edmingle_search_endpoints first.` };
      return ctx.client.call(e, {
        pathParams: args.pathParams, query: args.query, body: args.body,
        confirm: args.confirm, dryRun: args.dryRun,
      });
    },
  };
}

// Compact JSON for the small catalog-metadata tools (sections/search/describe).
function asText(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
}

export function registerGatewayTools(server: McpServer, ctx: ToolCtx): void {
  const h = gatewayHandlers(ctx);

  server.tool(
    'edmingle_list_sections',
    'List the top-level Edmingle API sections and how many endpoints each has.',
    {},
    async () => asText(h.listSections()),
  );

  server.tool(
    'edmingle_search_endpoints',
    'Search all 223 Edmingle endpoints by keyword. Returns endpoint ids to use with describe/call.',
    { query: z.string().describe('keywords, e.g. "create course" or "sales report"') },
    async (args) => asText(h.searchEndpoints(args)),
  );

  server.tool(
    'edmingle_describe_endpoint',
    'Get the full schema (params, body example, destructive flag) for one endpoint id.',
    { id: z.string().describe('endpoint id from search') },
    async (args) => asText(h.describeEndpoint(args)),
  );

  server.tool(
    'edmingle_call',
    'Execute ANY Edmingle endpoint by id. Destructive endpoints require confirm:true. Use dryRun:true to preview.',
    {
      id: z.string(),
      pathParams: z.record(z.union([z.string(), z.number()])).optional(),
      query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
      body: z.any().optional(),
      confirm: z.boolean().optional().describe('required true for destructive endpoints'),
      dryRun: z.boolean().optional().describe('preview the request without sending'),
    },
    async (args) => formatResult(await h.callEndpoint(args)),
  );
}
