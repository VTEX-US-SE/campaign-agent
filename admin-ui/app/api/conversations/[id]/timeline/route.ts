import type { NextRequest } from "next/server";
import z from "zod";

const BASE =
  process.env.BB_CONVERSATIONS_BASE_URL || "/api/proxy/myvtex/conversations";

const headersSchema = z.object({
  limit: z.string().optional(),
  "x-vtex-client-account": z.string(),
  "x-vtex-client-token": z.string(),
  "x-vtex-user-agent": z.string(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const headers = request.headers;

  const parseResult = headersSchema.safeParse(
    Object.fromEntries(headers.entries())
  );

  if (!parseResult.success) {
    return new Response("Invalid headers", { status: 400 });
  }

  const {
    limit,
    "x-vtex-client-account": account,
    "x-vtex-client-token": token,
    "x-vtex-user-agent": agentId,
  } = parseResult.data;

  if (!account || !token || !agentId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const res = await fetch(`${BASE}/${id}/timeline?limit=${limit ?? ""}`, {
    headers: {
      "X-VTEX-CLIENT-ACCOUNT": account,
      "X-VTEX-USER-AGENT": agentId,
      "X-VTEX-CLIENT-TOKEN": token,
      Cookie: `VtexIdclientAutCookie=${encodeURIComponent(token)}`,
    },
  });

  if (!res.ok) {
    return new Response("Failed to fetch conversations", {
      status: res.status,
    });
  }

  const { items = [] } = await res.json();

  return new Response(JSON.stringify(items), {
    status: 200,
  });
}



