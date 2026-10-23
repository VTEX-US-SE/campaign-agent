import type { NextRequest } from "next/server";

const BASE =
  process.env.BB_CONVERSATIONS_BASE_URL || "/api/proxy/myvtex/conversations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const account = request.headers.get("x-vtex-client-account");
  const token = request.headers.get("x-vtex-client-token");

  if (!account || !token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/campaign`, {
    headers: {
      "X-VTEX-CLIENT-ACCOUNT": account,
      "X-VTEX-CLIENT-TOKEN": token,
      Cookie: `VtexIdclientAutCookie=${encodeURIComponent(token)}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return new Response("Failed to fetch campaign steps", { status: res.status });
  }

  return new Response(await res.text(), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
