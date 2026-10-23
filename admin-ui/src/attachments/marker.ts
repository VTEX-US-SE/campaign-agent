/**
 * Helpers for the synthetic `[Attached file: ...]` marker that the backend
 * appends to user messages whenever a `vtex-artifact://` resource link is
 * sent alongside text input.
 *
 * The marker is meant for the LLM (so it can see the user uploaded a file
 * across turns), but it ends up persisted in the message text and leaks into
 * the timeline replay. We parse it on the frontend so we can:
 *
 *   - strip it from the rendered user text, and
 *   - re-create the resource-link chip the user originally saw.
 *
 * It must stay in lockstep with `inputs.py::_format_resource_link` on the
 * backend. Update both files together when the marker format changes.
 */

export const VTEX_ARTIFACT_SCHEME = 'vtex-artifact://'

// The `size: <bytes>` segment is optional so markers persisted before size
// was added (and markers for blocks without a size) still parse. `uri` stays
// the last field so its `[^\s)]+` capture is unambiguous.
const MARKER_PATTERN =
  /\[Attached file: (.*?) \(mime: (.*?)(?:, size: (\d+))?, uri: (vtex-artifact:\/\/[^\s)]+)\)\]/g

export interface ParsedAttachment {
  artifactId: string
  uri: string
  name: string
  mimeType: string
  size?: number
}

export interface ParsedMarkers {
  strippedText: string
  attachments: ParsedAttachment[]
}

export function parseAttachmentMarkers(text: unknown): ParsedMarkers {
  if (typeof text !== 'string' || !text) {
    return { strippedText: typeof text === 'string' ? text : '', attachments: [] }
  }

  const attachments: ParsedAttachment[] = []
  const seen = new Set<string>()

  const stripped = text.replace(
    MARKER_PATTERN,
    (_, rawName, rawMime, rawSize, uri) => {
      const name = String(rawName).trim()
      const mimeType = String(rawMime).trim()
      const safeUri = String(uri)
      const artifactId = safeUri.slice(VTEX_ARTIFACT_SCHEME.length)

      if (!artifactId || seen.has(artifactId)) {
        return ''
      }
      seen.add(artifactId)

      const size =
        typeof rawSize === 'string' && rawSize.length > 0
          ? Number(rawSize)
          : undefined

      attachments.push({ artifactId, uri: safeUri, name, mimeType, size })
      return ''
    },
  )

  // Collapse the blank lines that used to separate the marker from the
  // surrounding text (`format_user_message_from_inputs` joins parts with
  // `\n\n`), then trim leading/trailing whitespace so an attachment-only
  // message renders as an empty bubble rather than a blank one.
  const normalized = stripped.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

  return { strippedText: normalized, attachments }
}
