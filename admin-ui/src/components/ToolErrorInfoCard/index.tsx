import { Alert, Text } from '@vtex/shoreline'

import { ToolOutputEnvelope } from '../../typings'
import { ToolCard } from '../ToolCard'
import { ToolSummaryTable } from '../ToolSummaryTable'
import { ToolTable, formatCellValue } from '../ToolTable'
import { SUMMARY_COLUMN_WIDTHS } from '../utils'

interface ToolErrorInfoCardProps {
  title: string
  output: ToolOutputEnvelope<unknown>
}

function toRows(data: unknown) {
  if (data === null || data === undefined) return []

  if (Array.isArray(data)) {
    return data.map((item, index) => ({
      id: `item-${index}`,
      cells: [`Item ${index + 1}`, formatCellValue(item)],
    }))
  }

  if (typeof data === 'object') {
    return Object.entries(data).map(([key, value]) => ({
      id: key,
      cells: [key, formatCellValue(value)],
    }))
  }

  return [{ id: 'value', cells: ['Value', formatCellValue(data)] }]
}

export function ToolErrorInfoCard({ title, output }: ToolErrorInfoCardProps) {
  const metadataRows = [
    output.code ? { id: 'code', label: 'Code', value: output.code } : null,
    output.account ? { id: 'account', label: 'Account', value: output.account } : null,
  ].filter(Boolean) as Array<{ id: string; label: string; value: string | number }>

  const dataRows = toRows(output.data)

  return (
    <ToolCard title={title}>
      <Alert variant="critical">
        <Text variant="body">{output.message || 'The operation failed.'}</Text>
      </Alert>

      {metadataRows.length > 0 ? (
        <ToolSummaryTable rows={metadataRows} ariaLabel="Error metadata" />
      ) : null}

      {dataRows.length > 0 ? (
        <ToolTable
          columns={[
            { id: 'field', header: 'Detail' },
            { id: 'value', header: 'Value' },
          ]}
          rows={dataRows}
          emptyMessage="No additional error details returned."
          columnWidths={SUMMARY_COLUMN_WIDTHS}
          ariaLabel="Error details"
        />
      ) : null}
    </ToolCard>
  )
}
