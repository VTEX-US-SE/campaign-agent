import { useFetcher, useStatus } from '@vtex/agentic-ui'
import {
  Flex,
  IconArrowUpRightSmall,
  IconCheckCircleFill,
  IconWarningCircleFill,
  Spinner,
  Text,
} from '@vtex/shoreline'
import { useCallback, useEffect, useState } from 'react'

export type StepStatus = 'pending' | 'running' | 'done' | 'failed'

export interface CampaignStep {
  id: string
  label: string
  status: StepStatus
  detail?: string
  url?: string
  error?: string
}

export interface CampaignStepsData {
  plan: { name: string; discountPercent: number; beginDate: string; endDate: string; slug: string } | null
  confirmed: boolean
  steps: CampaignStep[]
}

const POLL_MS = 2500

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done') return <IconCheckCircleFill style={{ color: 'var(--sl-fg-success)' }} />
  if (status === 'failed') return <IconWarningCircleFill style={{ color: 'var(--sl-fg-critical)' }} />
  if (status === 'running') return <Spinner />
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 16,
        height: 16,
        margin: 2,
        borderRadius: '50%',
        border: '1.5px solid var(--sl-color-gray-6, #c4c4c4)',
      }}
    />
  )
}

export function CampaignStepsView({ data }: { data: CampaignStepsData }) {
  return (
    <Flex direction="column" gap="var(--sl-space-4)">
      <Flex direction="column" gap="var(--sl-space-1)">
        <Text variant="display4">Campaign steps</Text>
        {data.plan ? (
          <Text variant="caption1" style={{ color: 'var(--sl-fg-base-soft)' }}>
            {data.plan.name} · {data.plan.discountPercent}% off · {data.plan.beginDate} to {data.plan.endDate}
          </Text>
        ) : (
          <Text variant="caption1" style={{ color: 'var(--sl-fg-base-soft)' }}>
            Describe a campaign to start.
          </Text>
        )}
        {data.plan && !data.confirmed ? (
          <Text variant="caption1" style={{ color: 'var(--sl-fg-base-soft)' }}>
            Nothing is created until you confirm the plan.
          </Text>
        ) : null}
      </Flex>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sl-space-1)' }}>
        {data.steps.map((step) => {
          const clickable = step.status === 'done' && Boolean(step.url)
          const body = (
            <Flex align="start" gap="var(--sl-space-3)">
              <span style={{ display: 'flex', paddingTop: 2 }}>
                <StepIcon status={step.status} />
              </span>
              <Flex direction="column" gap="var(--sl-space-05)" style={{ minWidth: 0, flex: 1 }}>
                <Flex align="center" gap="var(--sl-space-1)">
                  <Text
                    variant={step.status === 'pending' ? 'body' : 'emphasis'}
                    style={{ color: step.status === 'pending' ? 'var(--sl-fg-base-soft)' : undefined }}
                  >
                    {step.label}
                  </Text>
                  {clickable ? <IconArrowUpRightSmall aria-hidden /> : null}
                </Flex>
                {step.detail || step.error ? (
                  <Text
                    variant="caption1"
                    style={{
                      color: step.error ? 'var(--sl-fg-critical)' : 'var(--sl-fg-base-soft)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={step.error ?? step.detail}
                  >
                    {step.error ?? step.detail}
                  </Text>
                ) : null}
              </Flex>
            </Flex>
          )

          return (
            <li key={step.id}>
              {clickable ? (
                <a
                  href={step.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-campaign-step-link
                  style={{
                    display: 'block',
                    padding: 'var(--sl-space-2) var(--sl-space-3)',
                    borderRadius: 'var(--sl-radius-2, 6px)',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  {body}
                </a>
              ) : (
                <div style={{ padding: 'var(--sl-space-2) var(--sl-space-3)' }}>{body}</div>
              )}
            </li>
          )
        })}
      </ol>
    </Flex>
  )
}

/** Right-hand column listing what the agent builds, linking to each created resource. */
export function CampaignStepsPanel({ threadId }: { threadId?: string | null }) {
  const fetcher = useFetcher()
  const { loading } = useStatus()
  const [data, setData] = useState<CampaignStepsData | null>(null)

  const refresh = useCallback(async () => {
    if (!threadId) return
    try {
      const res = await fetcher(`/api/conversations/${threadId}/campaign`, { cache: 'no-store' })
      if (res.ok) setData((await res.json()) as CampaignStepsData)
    } catch {
      // Keep the last known state; the next poll retries.
    }
  }, [fetcher, threadId])

  useEffect(() => {
    setData(null)
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!loading) {
      void refresh()
      return
    }
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [loading, refresh])

  return (
    <aside
      data-campaign-steps
      style={{
        width: 300,
        flexShrink: 0,
        alignSelf: 'stretch',
        overflowY: 'auto',
        padding: 'var(--sl-space-5)',
        borderLeft: 'var(--sl-border-base, 1px solid #e0e0e0)',
      }}
    >
      {data ? (
        <CampaignStepsView data={data} />
      ) : (
        <Flex justify="center" style={{ paddingTop: 'var(--sl-space-6)' }}>
          <Spinner />
        </Flex>
      )}
    </aside>
  )
}
