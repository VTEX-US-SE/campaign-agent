import { ToolOutputEnvelope } from './typings'

/**
 * Unwrap the tool output into a consistent ``ToolOutputEnvelope``.
 *
 * The VTEX UI protocol delivers tool results as a Strands ``ToolResultContent``
 * array (``[{ json: <payload> }, ...]``).  The first element's ``json`` key
 * holds the ``structured_response`` envelope emitted by every backend tool.
 *
 * Fallback path: if ``output`` already looks like an envelope (has ``status``,
 * ``message`` and ``data`` keys) it is returned as-is — this keeps unit tests
 * that pass the envelope directly working without changes.
 */
export function getToolOutput<TData>(output: unknown): ToolOutputEnvelope<TData> | null {
  if (!output || typeof output !== 'object') return null

  // Strands delivers tool output as [{ json: <envelope> }, ...].
  // Unwrap the first content block when the outer value is an array.
  if (Array.isArray(output)) {
    const first = output[0]
    if (first && typeof first === 'object' && 'json' in first) {
      return getToolOutput<TData>((first as Record<string, unknown>).json)
    }
    // Array without a json block — nothing useful to render.
    return null
  }

  const asRecord = output as Record<string, unknown>
  const hasEnvelopeFields = 'status' in asRecord && 'message' in asRecord && 'data' in asRecord

  if (!hasEnvelopeFields) {
    return {
      status: 'success',
      data: output as TData,
    }
  }

  return asRecord as ToolOutputEnvelope<TData>
}
