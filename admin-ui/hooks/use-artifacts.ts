import { useAgenticUI, useThreadId } from '@vtex/agentic-ui'
import { v7 as uuidv7 } from 'uuid'
import { useCallback, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toast } from '@vtex/shoreline'
import { useAdmin } from '@vtex/raccoon-next'

import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from '@/src/attachments/upload-limits'

export const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const

const FORMAT_ERROR_MESSAGE =
  'Formato de arquivo não suportado. Use: CSV ou Excel (.xls, .xlsx).'

const SIZE_ERROR_MESSAGE = `Arquivo muito grande. Máximo permitido: ${MAX_UPLOAD_LABEL}.`

/**
 * Shape persisted on the user message's `metadata.attachments` so the chat
 * timeline can re-render the resource-link chip on replay (see
 * `useAttachmentHydration`). Mirrors `ResourceLinkContent._meta` plus a few
 * display fields, using snake_case to match the rest of the Conversations
 * payload.
 */
export interface PersistedAttachment {
  artifact_id: string
  uri: string
  name: string
  mime_type: string
  size: number
}

function validateArtifactFile(
  file: File,
): { valid: true } | { valid: false; error: string } {
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase()
  if (
    !ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])
  ) {
    return { valid: false, error: FORMAT_ERROR_MESSAGE }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { valid: false, error: SIZE_ERROR_MESSAGE }
  }
  return { valid: true }
}

interface UploadResponse {
  artifact_id: string
  message_id: string
  status: string
}

export function useArtifacts(messageId: string) {
  const { threadId, setThreadId } = useThreadId()

  const { token, account } = useAdmin()
  const { agent } = useAgenticUI()

  const lastUploadSessionIdRef = useRef<string | null>(null)

  const [artifact, setArtifact] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<{
    isUploading: boolean
    artifactId?: string | null
  }>({ isUploading: false })

  const syncThreadIdBeforeSend = useCallback(() => {
    const sid = lastUploadSessionIdRef.current
    if (sid) {
      flushSync(() => {
        setThreadId(sid)
      })
    }
  }, [setThreadId])

  async function uploadArtifact(file: File) {
    const resolvedThreadId = threadId || uuidv7()
    lastUploadSessionIdRef.current = resolvedThreadId
    flushSync(() => {
      setThreadId(resolvedThreadId)
    })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('session_id', resolvedThreadId)
    formData.append('message_id', messageId)

    const response = await fetch('/api/artifact/upload', {
      method: 'POST',
      headers: {
        'x-vtex-client-token': token!!,
        'x-vtex-client-account': account!!,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload file')
    }

    const data: UploadResponse = await response.json()
    return data
  }

  async function handleArtifactUpload(files: File | File[]) {
    const file = Array.isArray(files) ? files[0] : files
    if (!file) return

    const validation = validateArtifactFile(file)
    if (!validation.valid) {
      toast.critical(validation.error)
      return
    }

    try {
      setArtifact(file)
      setUploadStatus({ isUploading: true, artifactId: null })

      const data = await uploadArtifact(file)

      setUploadStatus({
        isUploading: false,
        artifactId: data.artifact_id,
      })
    } catch (error) {
      console.error('Upload failed:', error)
      toast.critical('Falha no upload do arquivo. Tente novamente.')
      setArtifact(null)
      setUploadStatus({ isUploading: false, artifactId: null })
    }
  }

  function handleRemoveArtifact() {
    setArtifact(null)
    setUploadStatus({ isUploading: false, artifactId: null })
  }

  /**
   * Persist structured attachment info on the user message metadata so the
   * timeline can re-render the resource-link chip on replay.
   *
   * Fire-and-forget: if the conversations API is briefly unavailable the
   * legacy "[Attached file: ...]" marker stripping in `useAttachmentHydration`
   * still recovers a chip for the user. We only log on failure.
   */
  const persistAttachmentMetadata = useCallback(
    async (
      conversationId: string,
      userMessageId: string,
      attachments: PersistedAttachment[],
    ) => {
      if (!conversationId || !userMessageId || attachments.length === 0) return
      const agentId = agent?.id
      if (!token || !account || !agentId) return

      try {
        const response = await fetch(
          `/api/conversations/${conversationId}/messages/${userMessageId}/metadata`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-vtex-client-token': token,
              'x-vtex-client-account': account,
              'x-vtex-user-agent': agentId,
            },
            body: JSON.stringify({ metadata: { attachments } }),
          },
        )
        if (!response.ok) {
          console.warn(
            'Failed to persist attachment metadata',
            response.status,
            response.statusText,
          )
        }
      } catch (error) {
        console.warn('Failed to persist attachment metadata', error)
      }
    },
    [token, account, agent?.id],
  )

  return {
    handleArtifactUpload,
    handleRemoveArtifact,
    syncThreadIdBeforeSend,
    persistAttachmentMetadata,
    isUploading: uploadStatus.isUploading,
    artifact,
    setArtifact,
    artifactId: uploadStatus.artifactId,
  }
}
