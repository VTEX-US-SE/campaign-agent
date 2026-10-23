import {
  Flex,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
} from '@vtex/shoreline'
import type { ReactNode } from 'react'

interface ToolTableColumn {
  id: string
  header: string
}

interface ToolTableRow {
  id: string
  cells: ReactNode[]
}

interface ToolTableProps {
  columns: ToolTableColumn[]
  rows: ToolTableRow[]
  emptyMessage?: string
  columnWidths?: string[]
  ariaLabel?: string
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    if (value.length === 0) return '-'
    return value
      .map((item) => {
        if (item === null || item === undefined) return '-'
        if (typeof item === 'object') return JSON.stringify(item)
        return String(item)
      })
      .join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function ToolTable({
  columns,
  rows,
  emptyMessage = 'No data available.',
  columnWidths,
  ariaLabel,
}: ToolTableProps) {
  if (rows.length === 0) {
    return (
      <Text variant="caption1" role="status">
        {emptyMessage}
      </Text>
    )
  }

  const resolvedColumnWidths =
    columnWidths && columnWidths.length > 0
      ? columnWidths
      : columns.map(() => 'minmax(min-content, auto)')

  return (
    <Flex style={{ overflowX: 'auto' }}>
      <Table
        columnWidths={resolvedColumnWidths}
        aria-label={ariaLabel || columns.map((column) => column.header).join(', ')}
      >
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHeaderCell key={column.id}>{column.header}</TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.cells.map((cell, index) => (
                <TableCell key={`${row.id}-${index}`} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Flex>
  )
}
