import { ToolComponentProps } from '@vtex/agentic-ui'
import { Alert, Text } from '@vtex/shoreline'

import { getToolOutput } from '../../toolOutput'
import { ToolErrorInfoCard } from '../ToolErrorInfoCard'
import { ToolCard } from '../ToolCard'
import { ToolTable, formatCellValue } from '../ToolTable'
import { SUMMARY_COLUMN_WIDTHS, normalizeKeys } from '../utils'

type OperationResultData = Record<string, unknown>

function flattenObject(obj: Record<string, unknown>, prefix = ''): Array<[string, unknown]> {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix} > ${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return flattenObject(value as Record<string, unknown>, fullKey)
    }
    return [[fullKey, value]] as Array<[string, unknown]>
  })
}

function getOperationRows(data: unknown) {
  if (data === null || data === undefined) return []

  const normalized = normalizeKeys(data)

  if (Array.isArray(normalized)) {
    return normalized.map((item, index) => ({
      id: `item-${index}`,
      cells: [`Item ${index + 1}`, formatCellValue(item)],
    }))
  }

  if (typeof normalized === 'object') {
    return flattenObject(normalized as Record<string, unknown>).map(([key, value]) => ({
      id: key,
      cells: [key, formatCellValue(value)],
    }))
  }

  return [{ id: 'value', cells: ['Value', formatCellValue(normalized)] }]
}

export function OperationResultCard(props: ToolComponentProps) {
  const output = getToolOutput<OperationResultData>(props.data.output)

  if (!output) return null

  if (output.status === 'error') {
    return <ToolErrorInfoCard title="Operation failed" output={output} />
  }

  const message = output.message || 'Operation completed'
  const alertVariant = 'success'
  const rows = getOperationRows(output.data)

  return (
    <ToolCard title="Operation result">
      <Alert variant={alertVariant}>
        <Text variant="body">{message}</Text>
      </Alert>
      <ToolTable
        columns={[
          { id: 'field', header: 'Field' },
          { id: 'value', header: 'Value' },
        ]}
        rows={rows}
        emptyMessage="No additional details returned."
        columnWidths={SUMMARY_COLUMN_WIDTHS}
        ariaLabel="Operation result details"
      />
    </ToolCard>
  )
}
