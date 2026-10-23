import {
  AgentHome,
  ChatLayout,
  MessageComposer,
  MessageComposerArtifact,
  MessageComposerArtifactUpload,
  MessageComposerAttachments,
  MessageComposerControls,
  MessageComposerInput,
  MessageComposerSendButton,
  MessageComposerSuggestions,
  MessageComposerTextarea,
  Suggestion,
  useAgenticUI,
  useChatContext,
  useResetAtoms,
  useStatus,
} from '@vtex/agentic-ui'
import { sendAnalyticEvent } from '@vtex/raccoon-analytics'
import { useNavigation, isStandalone } from '@vtex/raccoon-next'
import { useMemo, useState } from 'react'
import { v7 as uuidv7 } from 'uuid'
import { ALLOWED_EXTENSIONS, useArtifacts } from '@/hooks/use-artifacts'
import { useAttachmentHydration } from '@/hooks/use-attachment-hydration'
import { ThinkingIndicator } from '@/src/components/ThinkingIndicator'

export default function AgenticPage() {
  const { reset } = useResetAtoms()
  const { agent } = useAgenticUI()

  const { stop, sendMessage, appSlug } = useChatContext()
  const { loading } = useStatus()
  const { navigate } = useNavigation()
  const [input, setInput] = useState('')
  const [messageId, setMessageId] = useState(uuidv7())

  const basePath = isStandalone() ? `/app/${appSlug}` : `/${appSlug}`

  const {
    artifact,
    setArtifact,
    handleArtifactUpload,
    handleRemoveArtifact,
    syncThreadIdBeforeSend,
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
      if (file && currentArtifactId) {
        syncThreadIdBeforeSend()
      }
      const { threadId } = await sendMessage(
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
        void persistAttachmentMetadata(threadId, currentMessageId, [
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

      navigate(`${basePath}/${threadId}`)
    } catch (error) {
      console.log({ error })
    }
  }

  return (
    <ChatLayout
      type="home"
      onThreadClick={(threadId) => {
        reset()
        navigate(`${basePath}/${threadId}`)
      }}
      onSendFeedback={async (name, feedback) => {
        await sendAnalyticEvent(name, feedback)
      }}
    >
      <div data-chat-container data-is-empty>
        <AgentHome
          title={agent?.ui.title}
          subtitle={agent?.ui.subtitle}
          name={agent?.ui.name}
        />

        <ThinkingIndicator active={loading} />

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

          <MessageComposerSuggestions>
            {agent?.ui.promptSuggestions.map((prompt) => {
              return (
                <Suggestion
                  key={prompt.title}
                  title={prompt.title}
                  description={prompt.description}
                  promptText={prompt.promptText}
                  requiresUrl={prompt.requiresUrl}
                  requiresImage={prompt.requiresImage}
                />
              )
            })}
          </MessageComposerSuggestions>
        </MessageComposer>
      </div>
    </ChatLayout>
  )
}
