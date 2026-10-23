import { ToolComponentProps } from '@vtex/agentic-ui'
import { Flex, Link, Text } from '@vtex/shoreline'

import { getToolOutput } from '../../toolOutput'
import { ToolErrorInfoCard } from '../ToolErrorInfoCard'
import { ToolCard } from '../ToolCard'
import { ToolSummaryTable } from '../ToolSummaryTable'

export interface CampaignBanner {
  id: string
  label: string
  url: string
  aspectRatio?: string
}

export interface CampaignContentData {
  headline?: string
  subheadline?: string
  sentences?: string[]
  cta?: { label: string; url?: string }
  seo?: { title?: string; description?: string }
  banners?: CampaignBanner[]
}

export function CampaignContentCard(props: ToolComponentProps) {
  const output = getToolOutput<CampaignContentData>(props.data.output)

  if (output?.status === 'error') {
    return <ToolErrorInfoCard title="Campaign content failed" output={output} />
  }

  const data = output?.data
  if (!data) return null

  const banners = data.banners ?? []
  const hasCopy = Boolean(data.headline || data.subheadline || data.sentences?.length || data.cta || data.seo)

  const copyRows = [
    { id: 'headline', label: 'Headline', value: data.headline },
    { id: 'subheadline', label: 'Subheadline', value: data.subheadline },
    { id: 'cta', label: 'Call to action', value: data.cta?.label },
    { id: 'seoTitle', label: 'SEO title', value: data.seo?.title },
    { id: 'seoDescription', label: 'SEO description', value: data.seo?.description },
  ].filter((row) => row.value)

  return (
    <ToolCard
      title={banners.length && !hasCopy ? 'Campaign banners' : 'Campaign content'}
      message={output?.message}
    >
      {copyRows.length ? <ToolSummaryTable rows={copyRows} ariaLabel="Campaign copy" /> : null}

      {data.sentences?.length ? (
        <Flex direction="column" gap="var(--sl-space-1)">
          <Text variant="emphasis">Landing page sentences</Text>
          {data.sentences.map((sentence, index) => (
            <Text key={index} variant="body">
              {sentence}
            </Text>
          ))}
        </Flex>
      ) : null}

      {banners.length ? (
        <Flex wrap="wrap" gap="var(--sl-space-3)">
          {banners.map((banner) => (
            <Flex key={banner.id} direction="column" gap="var(--sl-space-1)" style={{ maxWidth: 320 }}>
              <Link href={banner.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${banner.label}`}>
                <img
                  src={banner.url}
                  alt={banner.label}
                  style={{
                    width: '100%',
                    borderRadius: 'var(--sl-border-radius-medium)',
                    border: '1px solid var(--sl-color-border-base)',
                    display: 'block',
                  }}
                />
              </Link>
              <Text variant="caption1" style={{ color: 'var(--sl-fg-base-soft)' }}>
                {banner.label}
                {banner.aspectRatio ? ` (${banner.aspectRatio})` : ''}
              </Text>
            </Flex>
          ))}
        </Flex>
      ) : null}
    </ToolCard>
  )
}
