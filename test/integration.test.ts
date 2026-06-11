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
