import type { NextRequest } from "next/server";
import z from "zod";

const BASE =
  process.env.BB_CONVERSATIONS_BASE_URL || "/api/proxy/myvtex/conversations";

const headersSchema = z.object({
  "x-vtex-client-account": z.string(),
  "x-vtex-client-token": z.string(),
  "x-vtex-user-agent": z.string(),
});

const bodySchema = z.object({
  metadata: z.record(z.unknown()),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id, messageId } = await params;
  const headers = request.headers;

  const parseResult = headersSchema.safeParse(
    Object.fromEntries(headers.entries())
  );
  if (!parseResult.success) {
    return new Response("Invalid headers", { status: 400 });
  }

  const {
    "x-vtex-client-account": account,
    "x-vtex-client-token": token,
    "x-vtex-user-agent": agentId,
  } = parseResult.data;

  if (!account || !token || !agentId) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { metadata: Record<string, unknown> };
  try {
    const json = await request.json();
    const parsedBody = bodySchema.safeParse(json);
    if (!parsedBody.success) {
      return new Response("Invalid body", { status: 400 });
    }
    body = parsedBody.data;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // The Conversations service merges the patched metadata onto the existing
  // message. We forward it as-is so the user-message timeline carries the
  // structured attachment info on replay.
  const res = await fetch(`${BASE}/${id}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-CLIENT-ACCOUNT": account,
      "X-VTEX-USER-AGENT": agentId,
      "X-VTEX-CLIENT-TOKEN": token,
      Cookie: `VtexIdclientAutCookie=${encodeURIComponent(token)}`,
    },
    body: JSON.stringify({ metadata: body.metadata }),
  });

  if (!res.ok) {
    return new Response("Failed to patch message metadata", {
      status: res.status,
    });
  }

  const payload = res.headers.get("content-type")?.includes("application/json")
    ? await res.json()
    : {};

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
