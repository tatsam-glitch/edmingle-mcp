import { describe, it, expect, beforeAll } from 'vitest';
import { createMcpServer } from '../lib/server.js';

beforeAll(() => {
  process.env.EDMINGLE_API_URL = 'https://test.example.com/v1';
  process.env.EDMINGLE_APIKEY = 'test-key';
  process.env.EDMINGLE_ORGID = '1';
  process.env.EDMINGLE_INSTITUTION_ID = '1';
});

describe('createMcpServer', () => {
  it('creates a server and returns it', () => {
    const { server } = createMcpServer();
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe('function');
  });
});
