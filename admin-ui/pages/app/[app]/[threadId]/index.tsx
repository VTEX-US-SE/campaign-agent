import {
  CanvasContainer,
  ChatLayout,
  MessageComposer,
  MessageComposerArtifact,
  MessageComposerArtifactUpload,
  MessageComposerAttachments,
  MessageComposerControls,
  MessageComposerFeedback,
  MessageComposerInput,
  MessageComposerSendButton,
  MessageComposerTextarea,
  MessagesArea,
  useCanvas,
  useChatContext,
  useMessageIds,
  useResetAtoms,
  useStatus,
  useThreadId,
} from '@vtex/agentic-ui'
import { useNavigation, isStandalone } from '@vtex/raccoon-next'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { v7 as uuidv7 } from 'uuid'
import { ALLOWED_EXTENSIONS, useArtifacts } from '@/hooks/use-artifacts'
import { useAttachmentHydration } from '@/hooks/use-attachment-hydration'
import { CampaignStepsPanel } from '@/src/components/CampaignStepsPanel'
import { showThinkingIndicator, ThinkingIndicator } from '@/src/components/ThinkingIndicator'

export default function AgenticPage() {
  const { stop, sendMessage, appSlug } = useChatContext()
  const { navigate } = useNavigation()
  const router = useRouter()
  const { threadId, setThreadId } = useThreadId()
  const { reset } = useResetAtoms()
  const { loading } = useStatus()
  const { messageIds } = useMessageIds()
  const { open: canvasOpen } = useCanvas()
  const [input, setInput] = useState('')
  const [messageId, setMessageId] = useState(uuidv7())

  const basePath = isStandalone() ? `/app/${appSlug}` : `/${appSlug}`

  const {
    artifact,
    setArtifact,
    handleArtifactUpload,
    handleRemoveArtifact,
    persistAttachmentMetadata,
    isUploading,
    artifactId,
  } = useArtifacts(messageId)

  useAttachmentHydration()

  const isComposerEmpty = useMemo(() => {
    const hasBlockingUpload = Boolean(artifact) && isUploading
    const hasNoContent = !input.trim() && !artifact
    return hasNoContent || hasBlockingUpload
  }, [artifact, isUploading, input])

  async function handleSendMessage() {
    const userContent = input.trim()
    const currentMessageId = messageId
    const file = artifact
    const currentArtifactId = artifactId

    if (file && (isUploading || !currentArtifactId)) return
    if (!userContent && !file) return

    try {
      const { threadId: resolvedThreadId } = await sendMessage(
        {
          inputs: [
            ...(userContent ? [{ type: 'text', text: userContent }] : []),
            ...(file && currentArtifactId
              ? [
                  {
                    type: 'resource_link',
                    uri: `vtex-artifact://${currentArtifactId}`,
                    name: file.name,
                    description: '',
                    mimeType: file.type,
                    size: file.size,
                    _meta: {
                      artifact_id: currentArtifactId,
                      original_filename: file.name,
                      message_id: currentMessageId,
                    },
                  } as any,
                ]
              : []),
          ],
        },
        { messageId: currentMessageId },
      )

      if (file && currentArtifactId) {
        void persistAttachmentMetadata(resolvedThreadId, currentMessageId, [
          {
            artifact_id: currentArtifactId,
            uri: `vtex-artifact://${currentArtifactId}`,
            name: file.name,
            mime_type: file.type,
            size: file.size,
          },
        ])
      }

      setInput('')
      setArtifact(null)
      setMessageId(uuidv7())
    } catch (error) {
      console.log({ error })
    }
  }

  useEffect(() => {
    if (!router.query.threadId || Array.isArray(router.query.threadId)) return

    if (threadId === router.query.threadId) return

    setThreadId(router.query.threadId)
  }, [router.query.threadId])

  return (
    <ChatLayout
      type="thread"
      onNavigateBack={() => {
        reset()
        navigate(basePath)
      }}
      onThreadClick={(threadId) => {
        reset()
        navigate(`${basePath}/${threadId}`)
      }}
    >
      <CanvasContainer />
      <div data-campaign-layout>
        <div data-chat-container data-is-empty={false}>
          <MessagesArea messageIds={messageIds} error={null} isLoading={loading} />
          <ThinkingIndicator active={showThinkingIndicator(loading, messageIds)} />

          <MessageComposer
            input={input}
            setInput={setInput}
            isLoading={loading}
            isEmpty={isComposerEmpty}
            onSend={handleSendMessage}
            onStop={stop}
          >
            <MessageComposerInput autoGrow>
              {artifact && (
                <MessageComposerAttachments>
                  <MessageComposerArtifact
                    file={artifact}
                    onRemove={handleRemoveArtifact}
                    isLoading={isUploading}
                  />
                </MessageComposerAttachments>
              )}
              <MessageComposerTextarea />
              <MessageComposerControls>
                <MessageComposerArtifactUpload
                  onArtifactUpload={handleArtifactUpload}
                  accept={ALLOWED_EXTENSIONS.join(',')}
                  multiple={false}
                />
                <MessageComposerSendButton />
              </MessageComposerControls>
            </MessageComposerInput>
            <MessageComposerFeedback />
          </MessageComposer>
        </div>
        {canvasOpen ? null : <CampaignStepsPanel threadId={threadId} />}
      </div>
    </ChatLayout>
  )
}
