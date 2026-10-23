import { type NextRequest, NextResponse } from "next/server";
import z from "zod";

const headersSchema = z.object({
  "x-vtex-client-account": z.string(),
  "x-vtex-client-token": z.string(),
  "x-vtex-agent": z.string(),
});

export async function GET(req: NextRequest) {
  const agent = req.headers.get("x-vtex-agent");
  if (!agent) return new Response("Missing agent header", { status: 400 });

  const isLocalhost =
    agent.includes("localhost") || agent.includes("127.0.0.1");
  const url = `${isLocalhost ? "http" : "https"}://${agent}/mcp/`;

  const upstreamHeaders = new Headers(req.headers);

  upstreamHeaders.delete("x-vtex-agent");

  upstreamHeaders.set("content-type", "application/json");
  upstreamHeaders.set("accept", "application/json, text/event-stream");

  const upstreamRes = await fetch(url, {
    method: "GET",
    headers: upstreamHeaders,
  });

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    headers: upstreamRes.headers,
  });
}

export async function POST(req: NextRequest) {
  const headers = req.headers;
  const parseResult = headersSchema.safeParse(
    Object.fromEntries(headers.entries())
  );

  if (!parseResult.success) {
    return new Response("Invalid headers", { status: 400 });
  }

  const { "x-vtex-agent": agent } = parseResult.data;

  const isLocalhost =
    agent.includes("localhost") || agent.includes("127.0.0.1");

  const url = `${isLocalhost ? "http" : "https"}://${agent}/mcp/`;

  try {
    const upstreamHeaders = new Headers(req.headers);

    upstreamHeaders.delete("x-vtex-agent");

    upstreamHeaders.set("content-type", "application/json");
    upstreamHeaders.set("accept", "application/json, text/event-stream");

    const upstreamRes = await fetch(url, {
      method: "POST",
      headers: upstreamHeaders,
      body: req.body,
      // @ts-expect-error: missing duplex type
      duplex: "half",
    });

    const headers = new Headers(upstreamRes.headers);
    headers.delete("transfer-encoding");

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const errorCause =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : undefined;

    console.error("MCP proxy error:", {
      message: errorMessage,
      cause: errorCause,
      url,
      error: err,
    });

    // Verifica se é um erro de conexão
    if (
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorCause?.includes("ECONNREFUSED")
    ) {
      return NextResponse.json(
        {
          error: `MCP server connection failed: ${err}`,
          message: `Unable to connect to MCP server at ${url}. Make sure the server is running.`,
          url,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "MCP proxy error",
        message: errorMessage,
        url,
      },
      { status: 500 }
    );
  }
}

