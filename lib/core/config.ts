export interface EdmingleConfig {
  apiUrl: string;
  apikey: string;
  orgid: string;
  institutionId: string;
  organizationId?: string;
  hostName?: string;
  readOnly: boolean;
  timeoutMs: number;
}

const REQUIRED = [
  'EDMINGLE_API_URL', 'EDMINGLE_APIKEY', 'EDMINGLE_ORGID', 'EDMINGLE_INSTITUTION_ID',
] as const;

export function loadConfig(env: Record<string, string | undefined> = process.env): EdmingleConfig {
  const missing = REQUIRED.filter((k) => !env[k] || env[k]!.trim() === '');
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  let apiUrl = env.EDMINGLE_API_URL!.trim();
  if (!apiUrl.endsWith('/')) apiUrl += '/';
  return {
    apiUrl,
    apikey: env.EDMINGLE_APIKEY!.trim(),
    orgid: env.EDMINGLE_ORGID!.trim(),
    institutionId: env.EDMINGLE_INSTITUTION_ID!.trim(),
    organizationId: env.EDMINGLE_ORGANIZATION_ID?.trim(),
    hostName: env.EDMINGLE_HOST_NAME?.trim(),
    readOnly: env.EDMINGLE_READ_ONLY === 'true',
    timeoutMs: env.EDMINGLE_TIMEOUT_MS ? parseInt(env.EDMINGLE_TIMEOUT_MS, 10) : 30000,
  };
}
