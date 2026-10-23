import { ToolComponentProps } from '@vtex/agentic-ui'
import { Button, Flex } from '@vtex/shoreline'

import { getToolOutput } from '../../toolOutput'
import { ToolErrorInfoCard } from '../ToolErrorInfoCard'
import { ToolCard } from '../ToolCard'
import { ToolSummaryTable } from '../ToolSummaryTable'

export interface LandingPageData {
  title?: string
  slug?: string
  branch?: string
  entryId?: string
  cmsUrl?: string | null
}

export function LandingPagePreviewCard(props: ToolComponentProps) {
  const output = getToolOutput<LandingPageData>(props.data.output)

  if (output?.status === 'error') {
    return <ToolErrorInfoCard title="Landing page creation failed" output={output} />
  }

  const data = output?.data
  if (!data) return null

  const summaryRows = [
    { id: 'title', label: 'Title', value: data.title },
    { id: 'slug', label: 'Slug', value: data.slug ? `/${data.slug}` : undefined },
    { id: 'branch', label: 'CMS branch', value: data.branch },
  ]

  return (
    <ToolCard title="Landing page" message={output?.message || 'Landing page saved in the CMS.'}>
      <ToolSummaryTable rows={summaryRows} ariaLabel="Landing page summary" />
      {data.cmsUrl ? (
        <Flex>
          <Button variant="primary" onClick={() => window.open(data.cmsUrl!, '_blank', 'noopener,noreferrer')}>
            Open in CMS
          </Button>
        </Flex>
      ) : null}
    </ToolCard>
  )
}
