import { Flex, Text } from '@vtex/shoreline'
import type { ReactNode } from 'react'

interface ToolCardProps {
  title: string
  message?: ReactNode
  children: ReactNode
}

export function ToolCard({ title, message, children }: ToolCardProps) {
  return (
    <section aria-label={title}>
      <Flex
        direction="column"
        gap="var(--sl-space-3)"
        style={{
          padding: 'var(--sl-space-3)',
          border: '1px solid var(--sl-color-border-base)',
          borderRadius: 'var(--sl-border-radius-medium)',
          background: 'var(--sl-color-bg-base)',
        }}
      >
        <Flex direction="column" gap="var(--sl-space-1)">
          <Text variant="emphasis">{title}</Text>
          {message ? <Text variant="body">{message}</Text> : null}
        </Flex>
        {children}
      </Flex>
    </section>
  )
}
