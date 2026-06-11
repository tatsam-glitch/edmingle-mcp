import type { CatalogEntry } from './types.js';
import type { EdmingleConfig } from './config.js';

export interface CallOptions {
  pathParams?: Record<string, string | number>;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  confirm?: boolean;
  dryRun?: boolean;
}

export interface BuiltRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface CallResult {
  ok: boolean;
  status?: number;
  data?: unknown;
  message?: string;
  request?: BuiltRequest;
}

const RETRY_STATUS = new Set([429, 502, 503, 504]);

export class EdmingleClient {
  constructor(
    private config: EdmingleConfig,
    private fetchImpl: typeof fetch = fetch,
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  buildRequest(entry: CatalogEntry, opts: CallOptions): BuiltRequest {
    const headers: Record<string, string> = {
      apikey: this.config.apikey,
      ORGID: this.config.orgid,
    };

    let url: string;
    if (entry.absoluteUrl) {
      url = entry.pathTemplate;
    } else {
      const defaults: Record<string, string> = {
        institutionId: this.config.institutionId,
        organizationId: this.config.organizationId ?? this.config.orgid,
      };
      const supplied = opts.pathParams ?? {};
      const path = entry.pathTemplate.replace(/[{<](\w+)[}>]/g, (_, k: string) => {
        const v = supplied[k] ?? defaults[k] ?? '';
        return encodeURIComponent(String(v));
      }).replace(/^\//, '');
      url = this.config.apiUrl + path;
    }

    // Auto-fill account-scoping query params the endpoint declares but the caller omitted,
    // so callers (and Claude) don't have to know to pass institution_id/organization_id.
    const query: Record<string, string | number | boolean> = { ...(opts.query ?? {}) };
    for (const qp of entry.queryParams) {
      if (query[qp.key] !== undefined) continue;
      if (qp.key === 'institution_id') query.institution_id = this.config.institutionId;
      else if (qp.key === 'organization_id') query.organization_id = this.config.organizationId ?? this.config.orgid;
      else if (qp.key === 'host_name' && this.config.hostName) query.host_name = this.config.hostName;
    }
    if (Object.keys(query).length) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) qs.append(k, String(v));
      url += (url.includes('?') ? '&' : '?') + qs.toString();
    }

    let body: string | undefined;
    if (opts.body !== undefined && opts.body !== null) {
      const enc = (obj: Record<string, unknown>): string => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(obj)) {
          p.append(k, typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
        }
        return p.toString();
      };
      switch (entry.bodyMode) {
        case 'json':
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify(opts.body);
          break;
        case 'jsonString': {
          // Edmingle's write convention: a single `JSONString` form field holding the JSON.
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          const p = new URLSearchParams();
          p.append('JSONString', JSON.stringify(opts.body));
          body = p.toString();
          break;
        }
        case 'formdata': {
          // Multi-field endpoints (JSONString + file). File upload is unsupported in v1;
          // we send the JSON part. If body has a `JSONString` key use it, else wrap the whole body.
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          const b = opts.body as Record<string, unknown>;
          const payload = 'JSONString' in b ? b.JSONString : b;
          const p = new URLSearchParams();
          p.append('JSONString', typeof payload === 'string' ? payload : JSON.stringify(payload));
          body = p.toString();
          break;
        }
        case 'urlencoded':
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          body = enc(opts.body as Record<string, unknown>);
          break;
        default: // 'none'
          break;
      }
    }

    return { method: entry.method, url, headers, body };
  }

  async call(entry: CatalogEntry, opts: CallOptions): Promise<CallResult> {
    if (this.config.readOnly && entry.method !== 'GET') {
      return { ok: false, message: `Server is in read-only mode; "${entry.name}" (${entry.method}) is blocked.` };
    }
    if (entry.destructive && !opts.confirm) {
      return {
        ok: false,
        message: `"${entry.name}" is destructive. Re-call with confirm:true after confirming with the user. Tip: pass dryRun:true to preview the request first.`,
      };
    }

    const req = this.buildRequest(entry, opts);
    if (opts.dryRun) {
      return { ok: true, request: req, message: 'dry run — request not sent' };
    }

    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let response: Response;
      try {
        response = await this.fetchImpl(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });
      } catch (err) {
        if (attempt === maxAttempts) {
          return { ok: false, message: `Network/timeout error: ${(err as Error).message}`, request: req };
        }
        await this.sleep(this.backoff(attempt));
        continue;
      }

      if (RETRY_STATUS.has(response.status) && attempt < maxAttempts) {
        await this.sleep(this.backoff(attempt));
        continue;
      }

      const data = await this.parse(response);
      if (response.ok) {
        return { ok: true, status: response.status, data, request: req };
      }
      return {
        ok: false,
        status: response.status,
        data,
        message: this.extractMessage(data, response.status),
        request: req,
      };
    }
    return { ok: false, message: 'Exhausted retries', request: req };
  }

  private backoff(attempt: number): number {
    const base = 300 * 2 ** (attempt - 1);
    return base + Math.floor((attempt * 137) % 200); // deterministic jitter, no Math.random
  }

  private async parse(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  private extractMessage(data: unknown, status: number): string {
    if (data && typeof data === 'object' && 'message' in data) {
      return String((data as Record<string, unknown>).message);
    }
    return `HTTP ${status}`;
  }
}
