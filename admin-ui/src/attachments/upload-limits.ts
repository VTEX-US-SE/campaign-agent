/**
 * Single source of truth for the chat upload size cap.
 * Vercel limits a serverless function's request body to 4.5 MB.
 */
const envOverride = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_BYTES)

export const MAX_UPLOAD_BYTES =
  envOverride > 0 ? envOverride : Math.floor(4.5 * 1024 * 1024)

/** Human-readable cap (e.g. `"4,5 MB"`) for user-facing messages. */
export const MAX_UPLOAD_LABEL = `${(
  MAX_UPLOAD_BYTES /
  (1024 * 1024)
).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
