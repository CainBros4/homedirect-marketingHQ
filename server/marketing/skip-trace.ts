// Skip tracing — converts property address + owner name into phone/email.
// Default provider: BatchData (formerly BatchSkipTracing) — ~$0.10-0.15 per
// record, 60-80% email hit rate. Logs every call to skip_trace_log for audit
// + cost tracking.
//
// The BatchData API auth landscape has shifted over time (x-api-key → Bearer,
// api.batchskiptracing.com → api.batchdata.com). We try Bearer against the
// modern endpoint first; on 401/404 we fall back to legacy host + x-api-key.
// Remove the fallback once we've confirmed which one works in production.

const apiKey = process.env.BATCH_SKIP_TRACING_API_KEY;
const API_BASE_MODERN = "https://api.batchdata.com/api/v1";
const API_BASE_LEGACY = "https://api.batchskiptracing.com/api/v1";

export interface SkipTraceInput {
  firstName?: string;
  lastName?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface SkipTraceResult {
  success: boolean;
  emails: string[];
  phones: string[];
  resultQuality: "hit" | "partial" | "miss" | "unknown";
  costCents: number;
  response: any;
  error?: string;
  stubbed?: boolean;
}

export function isSkipTraceConfigured(): boolean {
  return !!apiKey;
}

export async function skipTrace(input: SkipTraceInput): Promise<SkipTraceResult> {
  if (!apiKey) {
    console.log(`[marketing/skip-trace] STUB LOOKUP for ${input.address}, ${input.city} ${input.state} (no BATCH_SKIP_TRACING_API_KEY)`);
    return {
      success: true,
      stubbed: true,
      emails: [],
      phones: [],
      resultQuality: "unknown",
      costCents: 0,
      response: { stub: true },
    };
  }

  const body = JSON.stringify({
    requests: [
      {
        propertyAddress: {
          street: input.address,
          city: input.city,
          state: input.state,
          zip: input.zip,
        },
        name: {
          first: input.firstName,
          last: input.lastName,
        },
      },
    ],
  });

  async function attempt(url: string, authHeader: Record<string, string>): Promise<Response> {
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader },
      body,
    });
  }

  try {
    // Try 1: modern host + Bearer token
    let res = await attempt(`${API_BASE_MODERN}/property/skip-trace`, { Authorization: `Bearer ${apiKey}` });
    let usedPath = "modern+bearer";

    // Try 2: modern host + x-api-key header
    if (res.status === 401 || res.status === 403) {
      console.warn("[marketing/skip-trace] Bearer auth rejected, retrying with x-api-key header");
      res = await attempt(`${API_BASE_MODERN}/property/skip-trace`, { "x-api-key": apiKey });
      usedPath = "modern+x-api-key";
    }

    // Try 3: legacy host + x-api-key
    if (res.status === 404 || res.status === 401) {
      console.warn("[marketing/skip-trace] modern host failed, falling back to legacy host");
      res = await attempt(`${API_BASE_LEGACY}/property/skip-trace`, { "x-api-key": apiKey });
      usedPath = "legacy+x-api-key";
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[marketing/skip-trace] FAILED ${res.status} (${usedPath}):`, text);
      return {
        success: false,
        emails: [],
        phones: [],
        resultQuality: "miss",
        costCents: 0,
        response: { status: res.status, body: text, path: usedPath },
        error: `HTTP ${res.status} via ${usedPath}`,
      };
    }

    console.log(`[marketing/skip-trace] OK via ${usedPath}`);
    const data: any = await res.json();
    const result = data?.results?.[0] || data?.response?.results?.[0] || {};
    const emails = (result.emails || []).map((e: any) => e.email || e).filter(Boolean);
    const phones = (result.phoneNumbers || result.phones || []).map((p: any) => p.number || p).filter(Boolean);
    const quality: SkipTraceResult["resultQuality"] =
      emails.length && phones.length ? "hit" : emails.length || phones.length ? "partial" : "miss";

    return {
      success: true,
      emails,
      phones,
      resultQuality: quality,
      costCents: 15, // BatchSkipTracing charges ~$0.15 per traced record
      response: data,
    };
  } catch (err: any) {
    console.error(`[marketing/skip-trace] exception:`, err);
    return {
      success: false,
      emails: [],
      phones: [],
      resultQuality: "miss",
      costCents: 0,
      response: {},
      error: err?.message || "unknown",
    };
  }
}
