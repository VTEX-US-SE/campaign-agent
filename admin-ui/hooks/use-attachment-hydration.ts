import { useEffect, useRef } from 'react'
import {
  messageFamily,
  resourceLinkFamily,
  store,
  useMessageIds,
  useThreadId,
} from '@vtex/agentic-ui'

import {
  parseAttachmentMarkers,
  type ParsedAttachment,
  VTEX_ARTIFACT_SCHEME,
} from '@/src/attachments/marker'

const USER_FAMILY_PREFIX = 'user-'

/**
 * Rehydrates attachment chips for replayed user messages.
 *
 * Priority:
 * 1) Use `metadata.attachments` when available.
 * 2) Otherwise parse the `[Attached file: ...]` marker.
 *
 * The marker text is removed from the bubble, and hydration is idempotent:
 * each user family is processed once per session and links are deduped.
 */
export function useAttachmentHydration() {
  const { messageIds } = useMessageIds()
  const { threadId } = useThreadId()
  const processedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const familyId of messageIds) {
      if (!familyId.startsWith(USER_FAMILY_PREFIX)) continue
      if (processedRef.current.has(familyId)) continue

      const messageAtom = messageFamily(familyId)
      const message = store.get(messageAtom)
      if (!message || message.event === 'delta' || message.type !== 'text') {
        // Either not loaded yet, still streaming, or not a text message.
        // Don't mark as processed so a later effect run can pick it up.
        continue
      }

      const rawText = (message.data?.text?.value as string | undefined) ?? ''

      // Always parse the marker — even when metadata is present we still need
      // to strip it from the rendered text.
      const parsedFromText = parseAttachmentMarkers(rawText)
      const fromMetadata = readAttachmentsFromMetadata(message)
      const attachments =
        fromMetadata.length > 0 ? fromMetadata : parsedFromText.attachments

      processedRef.current.add(familyId)

      if (attachments.length === 0) continue

      const strippedText = parsedFromText.strippedText
      if (strippedText !== rawText) {
        store.set(messageAtom, {
          ...message,
          data: {
            ...message.data,
            text: {
              ...message.data.text,
              value: strippedText,
            },
          },
        })
      }

      const userMessageId = familyId.slice(USER_FAMILY_PREFIX.length)
      const linkAtom = resourceLinkFamily(familyId)
      const existing = store.get(linkAtom) ?? []
      const seen = collectExistingArtifactKeys(existing)

      const fresh = attachments
        .filter(
          (a) => !seen.has(a.artifactId) && (!a.uri || !seen.has(a.uri)),
        )
        .map((a, idx) =>
          buildResourceLinkEntry(a, {
            userMessageId,
            conversationId: threadId ?? message.conversationId ?? '',
            createdAt:
              (message.createdAt as string | undefined) ??
              new Date().toISOString(),
            indexHint: idx,
          }),
        )

      if (fresh.length > 0) {
        store.set(linkAtom, [...existing, ...fresh])
      }
    }
  }, [messageIds, threadId])
}

interface RawAttachmentMetadata {
  artifact_id?: unknown
  artifactId?: unknown
  uri?: unknown
  name?: unknown
  filename?: unknown
  mime_type?: unknown
  mimeType?: unknown
  size?: unknown
}

function readAttachmentsFromMetadata(message: unknown): ParsedAttachment[] {
  if (!message || typeof message !== 'object') return []

  const top = (message as Record<string, unknown>).metadata
  const inner = ((message as Record<string, unknown>).data as
    | Record<string, unknown>
    | undefined)?.metadata
  const meta = (top ?? inner) as Record<string, unknown> | undefined
  if (!meta || typeof meta !== 'object') return []

  const list = (meta as Record<string, unknown>).attachments
  if (!Array.isArray(list)) return []

  const out: ParsedAttachment[] = []
  for (const raw of list as RawAttachmentMetadata[]) {
    if (!raw || typeof raw !== 'object') continue

    const artifactId =
      (typeof raw.artifact_id === 'string' && raw.artifact_id) ||
      (typeof raw.artifactId === 'string' && raw.artifactId) ||
      ''
    if (!artifactId) continue

    const uri =
      typeof raw.uri === 'string' && raw.uri.length > 0
        ? raw.uri
        : `${VTEX_ARTIFACT_SCHEME}${artifactId}`

    const name =
      (typeof raw.name === 'string' && raw.name) ||
      (typeof raw.filename === 'string' && raw.filename) ||
      'attachment'

    const mimeType =
      (typeof raw.mime_type === 'string' && raw.mime_type) ||
      (typeof raw.mimeType === 'string' && raw.mimeType) ||
      'application/octet-stream'

    const size =
      typeof raw.size === 'number' &&
      Number.isFinite(raw.size) &&
      raw.size >= 0
        ? raw.size
        : undefined

    out.push({ artifactId, uri, name, mimeType, size })
  }
  return out
}

function collectExistingArtifactKeys(entries: unknown[]): Set<string> {
  const set = new Set<string>()
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const data = (entry as Record<string, unknown>).data as
      | Record<string, unknown>
      | undefined
    const meta = data?._meta as Record<string, unknown> | undefined
    const artifactId = typeof meta?.artifact_id === 'string' ? meta.artifact_id : null
    const uri = typeof data?.uri === 'string' ? data.uri : null
    if (artifactId) set.add(artifactId)
    if (uri) set.add(uri)
  }
  return set
}

interface BuildContext {
  userMessageId: string
  conversationId: string
  createdAt: string
  indexHint: number
}

function buildResourceLinkEntry(
  attachment: ParsedAttachment,
  ctx: BuildContext,
) {
  return {
    event: 'message' as const,
    type: 'resource_link' as const,
    id: `${ctx.userMessageId}-attachment-${ctx.indexHint}-${attachment.artifactId}`,
    parentMessageId: ctx.userMessageId,
    conversationId: ctx.conversationId,
    role: 'user' as const,
    createdAt: ctx.createdAt,
    data: {
      type: 'resource_link' as const,
      uri: attachment.uri,
      name: attachment.name,
      description: '',
      mimeType: attachment.mimeType,
      size: attachment.size ?? 0,
      _meta: {
        artifact_id: attachment.artifactId,
        message_id: ctx.userMessageId,
        original_filename: attachment.name,
      },
    },
  }
}
