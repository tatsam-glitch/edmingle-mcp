import type { CallResult } from '../core/client.js';

// Tool results must stay well under the MCP client's per-result token cap. Responses are
// serialized COMPACTLY (no pretty-print, which ~doubles size) and the echoed request is
// dropped on success (it's only useful for debugging errors / previewing dryRuns). A hard
// char cap is a final backstop so a huge response degrades gracefully instead of erroring.
export const MAX_RESULT_CHARS = 80_000;

export function formatResult(
  result: CallResult,
  maxChars: number = MAX_RESULT_CHARS,
): { content: { type: 'text'; text: string }[] } {
  const lean: Record<string, unknown> = { ok: result.ok };
  if (result.status !== undefined) lean.status = result.status;
  if (result.message !== undefined) lean.message = result.message;
  if (result.data !== undefined) lean.data = result.data;
  // Keep the request for errors/dryRun, but STRIP auth headers (teammates must not see the API key).
  if (result.request && (!result.ok || result.data === undefined)) {
    const { headers, ...rest } = result.request;
    const safeHeaders = { ...headers };
    delete safeHeaders['apikey'];
    delete safeHeaders['APIKEY'];
    delete safeHeaders['authorization'];
    delete safeHeaders['Authorization'];
    lean.request = { ...rest, headers: safeHeaders };
  }

  let text = JSON.stringify(lean);
  if (text.length > maxChars) {
    const dropped = text.length - maxChars;
    text =
      text.slice(0, maxChars) +
      `…[truncated ${dropped} chars — response too large; narrow the query or use page/per_page]`;
  }
  return { content: [{ type: 'text', text }] };
}
