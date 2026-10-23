import { DotsLoader } from '@vtex/agentic-ui'

/** Bouncing dots shown while the latest message is still the user's and the agent has not replied yet. */
export function ThinkingIndicator({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div data-thinking-indicator aria-live="polite" aria-label="The agent is thinking">
      <DotsLoader />
    </div>
  )
}

export function showThinkingIndicator(loading: boolean, messageIds: string[]) {
  const lastId = messageIds.at(-1)
  return loading && (!lastId || lastId.startsWith('user-'))
}
