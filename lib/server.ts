import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfig } from './core/config.js';
import { Catalog } from './core/catalog.js';
import { EdmingleClient } from './core/client.js';
import { registerGatewayTools, type ToolCtx } from './tools/gateway.js';
import { registerNamedTools } from './tools/named.js';

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
