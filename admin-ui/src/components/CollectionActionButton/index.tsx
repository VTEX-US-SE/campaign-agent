import { ToolComponentProps, useChatContext } from '@vtex/agentic-ui'
import { Alert, Button, Flex, Text } from '@vtex/shoreline'
import { useState } from 'react'

import { getToolOutput } from '../../toolOutput'
import type { OperationDetails as OperationDetailsType } from '../../typings'
import { OperationDetails } from '../OperationDetails'
import { ToolErrorInfoCard } from '../ToolErrorInfoCard'

/** Payload returned by the confirm_action backend tool. */
interface CollectionActionData {
  /** Short message shown above the button (fallback when details absent). */
  message: string
  /** Label displayed on the button. */
  action_label: string
  /** Text sent back to the agent when the user clicks. */
  confirm_text: string
  /**
   * Server-controlled structured operation details.
   * When present, replaces the plain-text ``message`` block with a
   * structured card.  The LLM never authors this field.
   */
  details?: OperationDetailsType
}

/**
 * CollectionActionButton renders a confirmation button inline in the chat.
 *
 * It is triggered by the backend `confirm_action` tool and lets the
 * user confirm a proposed action (e.g. creating a collection) without having to
 * type a reply manually. Clicking the button sends `confirm_text` back to the
 * agent as a new chat message.
 *
 * @example
 * // Registered via registerTool in src/tools.ts — no direct usage needed.
 */
export function CollectionActionButton(props: ToolComponentProps) {
  const output = getToolOutput<CollectionActionData>(props.data.output)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (output?.status === 'error') {
    return <ToolErrorInfoCard title="Collection action failed" output={output} />
  }

  const data = output?.data

  const { sendMessage } = useChatContext()

  if (!data) return null

  const { message, action_label, confirm_text } = data

  const handleConfirm = async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await sendMessage({
        inputs: [{ type: 'text', text: confirm_text }],
      })
    } catch {
      setSubmitError('Could not send the confirmation. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Flex
      direction="column"
      gap="var(--sl-space-3)"
      // fontFamily: tool components render outside the chat's markdown
      // containers, so default-variant (context) Shoreline text would
      // otherwise inherit the browser font instead of the chat typography.
      style={{ padding: 'var(--sl-space-3) 0', fontFamily: 'var(--sl-font-family-sans)' }}
    >
      {data.details ? (
        // Server-controlled structured card — the LLM never authors this.
        <OperationDetails details={data.details} />
      ) : (
        message && (
          // Preserve line breaks so multi-line summaries (e.g. the per-rule
          // breakdown emitted by ``create_collection`` when the rules array
          // contains more than one entry) render as separate lines instead
          // of a single collapsed paragraph.
          <Text variant="body" style={{ whiteSpace: 'pre-wrap' }}>
            {message}
          </Text>
        )
      )}
      {submitError ? (
        <Alert variant="critical">
          <Text variant="body">{submitError}</Text>
        </Alert>
      ) : null}
      <Flex>
        <Button variant="primary" onClick={handleConfirm} loading={isSubmitting} disabled={isSubmitting}>
          {action_label}
        </Button>
      </Flex>
    </Flex>
  )
}
