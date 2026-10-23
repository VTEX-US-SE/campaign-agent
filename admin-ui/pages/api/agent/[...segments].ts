import type { NextApiRequest, NextApiResponse } from "next";
import https from "https";

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

// HTTPS agent to handle self-signed certificates in development
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.NODE_ENV === "production",
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Build upstream path after /v1/agent/
  const seg = req.query.segments;
  const path = Array.isArray(seg) ? seg.join("/") : seg ?? "";

  // Use NEXT_PUBLIC_AGENT_BASE_URL directly (v0.4.x change)
  const baseUrl = process.env.NEXT_PUBLIC_AGENT_BASE_URL;
  if (!baseUrl) {
    res.status(500).json({ error: "NEXT_PUBLIC_AGENT_BASE_URL not configured" });
    return;
  }

  const url = new URL(`/v1/agent/${path}`, baseUrl);

  // Forward querystring (except catch-all param)
  Object.entries(req.query).forEach(([k, v]) => {
    if (k === "segments") return;
    if (Array.isArray(v)) v.forEach((vv) => url.searchParams.append(k, vv));
    else if (v != null) url.searchParams.set(k, String(v));
  });

  // Prepare headers for upstream, removing hop-by-hop headers
  const hopByHop = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]);
  const headers = new Headers();
  Object.entries(req.headers).forEach(([k, v]) => {
    if (hopByHop.has(k.toLowerCase())) return;
    if (Array.isArray(v)) headers.set(k, v.join(","));
    else if (v != null) headers.set(k, v);
  });

  // Harmonize VTEX auth
  const tokenQ =
    (Array.isArray(req.query.token) ? req.query.token[0] : req.query.token) ??
    (Array.isArray(req.query.token_query)
      ? req.query.token_query[0]
      : req.query.token_query);
  const agentIdQ = Array.isArray(req.query.agent_id)
    ? req.query.agent_id[0]
    : (req.query.agent_id as string | undefined);
  const accountQ = Array.isArray(req.query.account)
    ? req.query.account[0]
    : (req.query.account as string | undefined);
  const traceIdQ = Array.isArray(req.query.trace_id)
    ? req.query.trace_id[0]
    : (req.query.trace_id as string | undefined);

  if (traceIdQ && !headers.has("traceparent")) {
    headers.set("traceparent", traceIdQ);
  }

  if (accountQ && !headers.has("X-VTEX-CLIENT-ACCOUNT")) {
    headers.set("X-VTEX-CLIENT-ACCOUNT", String(accountQ));
  }

  if (agentIdQ) {
    if (!headers.has("X-VTEX-USER-AGENT")) {
      headers.set("X-VTEX-USER-AGENT", String(agentIdQ));
    }
  }

  const hasCookie = headers.has("cookie");
  if (!hasCookie && tokenQ) {
    const existing = headers.get("cookie");
    const tokenCookie = `VtexIdclientAutCookie=${encodeURIComponent(
      String(tokenQ)
    )}`;
    headers.set(
      "cookie",
      existing ? `${existing}; ${tokenCookie}` : tokenCookie
    );
  }

  if (tokenQ && !headers.has("X-VTEX-CLIENT-TOKEN")) {
    headers.set("X-VTEX-CLIENT-TOKEN", String(tokenQ));
  }

  // Forward body for non-GET methods (streaming-friendly)
  const ac = new AbortController();
  const init: RequestInit = {
    method: req.method,
    headers,
    signal: ac.signal,
    // @ts-ignore — Use custom HTTPS agent for self-signed certs
    agent: url.protocol === "https:" ? httpsAgent : undefined,
    // @ts-ignore — Node 18 fetch allows half-duplex streaming
    duplex: req.method !== "GET" && req.method !== "HEAD" ? "half" : undefined,
    body:
      req.method !== "GET" && req.method !== "HEAD" ? (req as any) : undefined,
  };

  // Abort upstream when client disconnects
  req.on("close", () => ac.abort());
  // Keep-alive for SSE
  // @ts-ignore
  res.socket?.setTimeout?.(0);

  const upstream = await fetch(url, init);
  const contentType = upstream.headers.get("content-type") || "";

  // SSE passthrough
  if (contentType.includes("text/event-stream")) {
    res.status(upstream.status);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // @ts-ignore
    res.flushHeaders?.();

    try {
      // web stream → Node response
      // @ts-ignore
      const reader = upstream.body?.getReader();
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(value);
      }
    } catch {
      // client closed / upstream dropped — just end
    } finally {
      res.end();
    }
    return;
  }

  // non-SSE: mirror response
  res.status(upstream.status);
  upstream.headers.forEach((val, key) => {
    if (key.toLowerCase() === "content-encoding") return; // let Next decide
    res.setHeader(key, val);
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}


