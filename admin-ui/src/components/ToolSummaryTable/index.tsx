import type { ReactNode } from 'react'

import { SUMMARY_COLUMN_WIDTHS } from '../utils'
import { ToolTable } from '../ToolTable'

interface ToolSummaryRow {
  id: string
  label: string
  value: ReactNode
}

interface ToolSummaryTableProps {
  rows: ToolSummaryRow[]
  ariaLabel?: string
}

function toCellValue(value: ReactNode): ReactNode {
  if (value === null || value === undefined || value === '') return '-'
  return value
}

export function ToolSummaryTable({ rows, ariaLabel }: ToolSummaryTableProps) {
  return (
    <ToolTable
      columns={[
        { id: 'field', header: 'Field' },
        { id: 'value', header: 'Value' },
      ]}
      rows={rows.map((row) => ({
        id: row.id,
        cells: [row.label, toCellValue(row.value)],
      }))}
      columnWidths={SUMMARY_COLUMN_WIDTHS}
      ariaLabel={ariaLabel}
    />
  )
}
