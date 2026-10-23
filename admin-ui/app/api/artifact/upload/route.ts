import z from "zod";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import crypto from "crypto";

import { MAX_UPLOAD_BYTES } from "@/src/attachments/upload-limits";

const BASE =
  process.env.BB_ARTIFACTS_BASE_URL ||
  "https://ai-building-block-artifacts-staging.vtex.systems";

const headersSchema = z.object({
  "x-vtex-client-account": z.string().min(1),
  "x-vtex-client-token": z.string().min(1),
});

export async function POST(request: Request) {
  const parseHeadersResult = headersSchema.safeParse(
    Object.fromEntries(request.headers.entries())
  );

  if (!parseHeadersResult.success) {
    return new Response("Invalid headers", { status: 400 });
  }

  const { "x-vtex-client-account": account, "x-vtex-client-token": token } =
    parseHeadersResult.data;

  if (!account || !token) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const sessionId = formData.get("session_id") as string;
    const messageId = formData.get("message_id") as string;

    if (!file || !sessionId || !messageId) {
      return new Response("Missing required fields", { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return new Response("File too large", { status: 413 });
    }

    const initiateResponse = await fetch(`${BASE}/v1/uploads/initiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vtex-client-account": account,
        "x-vtex-client-token": token,
      },
      body: JSON.stringify({
        session_id: sessionId,
        message_id: messageId,
        filename: file.name,
        mime: file.type,
        size: file.size,
      }),
    });

    if (!initiateResponse.ok) {
      return new Response("Failed to initiate upload", {
        status: initiateResponse.status,
      });
    }

    const initiateData = await initiateResponse.json();

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const s3Response = await fetch(initiateData.presigned.url, {
      method: initiateData.presigned.method,
      headers: initiateData.presigned.headers,
      body: fileBuffer,
    });

    if (!s3Response.ok) {
      return new Response("Failed to upload to S3", {
        status: s3Response.status,
      });
    }

    const hash = crypto.createHash("sha256");
    hash.update(fileBuffer);
    const sha256 = hash.digest("hex");

    const finalizeResponse = await fetch(
      `${BASE}/v1/uploads/${initiateData.upload_id}/finalize`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vtex-client-account": account,
          "x-vtex-client-token": token,
        },
        body: JSON.stringify({
          sha256,
          size: file.size,
        }),
      }
    );

    if (!finalizeResponse.ok) {
      return new Response("Failed to finalize upload", {
        status: finalizeResponse.status,
      });
    }

    const finalizeData = await finalizeResponse.json();

    return new Response(JSON.stringify(finalizeData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
