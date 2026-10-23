import { getToolOutput } from '../../toolOutput'
import { ToolErrorInfoCard } from '../ToolErrorInfoCard'
import { ToolCard } from '../ToolCard'
import { ToolSummaryTable } from '../ToolSummaryTable'
import { ToolTable } from '../ToolTable'
import { ToolComponentProps } from '@vtex/agentic-ui'

interface LookupItem {
  id?: number
  name?: string
  product_id?: number
}

interface LookupData {
  title?: string
  emptyMessage?: string
  query?: string
  total?: number
  items?: LookupItem[]
}

const TOOL_MODE_BY_NAME = {
  get_brand: 'brand',
  get_category: 'category',
  get_product: 'product',
  get_sku: 'sku',
  get_specification_value: 'specification',
} as const

type LookupMode = (typeof TOOL_MODE_BY_NAME)[keyof typeof TOOL_MODE_BY_NAME]

export function LookupResultsCard(props: ToolComponentProps) {
  const output = getToolOutput<LookupData>(props.data.output)

  if (output?.status === 'error') {
    return <ToolErrorInfoCard title="Lookup failed" output={output} />
  }

  const data = output?.data

  if (!data) return null

  const items = data.items || []
  const toolName = props.data.name as keyof typeof TOOL_MODE_BY_NAME
  const mode: LookupMode = TOOL_MODE_BY_NAME[toolName] || 'specification'

  const summaryRows = [
    { id: 'query', label: 'Query', value: data.query || '-' },
    { id: 'total', label: 'Total results', value: data.total ?? items.length },
  ]

  const rows = items.map((item, index) => ({
    id: `${item.id ?? index}`,
    cells:
      mode === 'sku'
        ? [item.id ?? '-', item.name || '-', item.product_id ?? '-']
        : [item.id ?? '-', item.name || '-'],
  }))

  return (
    <ToolCard
      title={data.title || 'Lookup results'}
      message={output?.message || `Found ${data.total ?? 0} result(s)`}
    >
      <ToolSummaryTable rows={summaryRows} ariaLabel="Lookup summary" />
      <ToolTable
        columns={
          mode === 'sku'
            ? [
                { id: 'id', header: 'ID' },
                { id: 'name', header: 'Name' },
                { id: 'product_id', header: 'Product ID' },
              ]
            : [
                { id: 'id', header: 'ID' },
                { id: 'name', header: 'Name' },
              ]
        }
        rows={rows}
        emptyMessage={data.emptyMessage || 'No results returned.'}
        ariaLabel={`${mode} lookup results`}
      />
    </ToolCard>
  )
}
