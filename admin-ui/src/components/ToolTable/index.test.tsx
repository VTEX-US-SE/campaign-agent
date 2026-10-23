import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@vtex/shoreline', () => {
  const Wrap = ({ children }: { children: ReactNode }) => <div>{children}</div>

  return {
    Flex: Wrap,
    Text: ({ children, ...props }: { children: ReactNode }) => <span {...props}>{children}</span>,
    Table: ({ children, columnWidths, ...props }: { children: ReactNode; columnWidths?: string[] }) => (
      <table {...props}>{children}</table>
    ),
    TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
    TableCell: ({ children, ...props }: { children: ReactNode }) => <td {...props}>{children}</td>,
    TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
    TableHeaderCell: ({ children }: { children: ReactNode }) => <th>{children}</th>,
    TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
  }
})

import { ToolTable, formatCellValue } from './index'

describe('ToolTable', () => {
  it('formats cell values consistently', () => {
    expect(formatCellValue(undefined)).toBe('-')
    expect(formatCellValue(true)).toBe('Yes')
    expect(formatCellValue(false)).toBe('No')
    expect(formatCellValue(['a', 2])).toBe('a, 2')
    expect(formatCellValue({ id: 10 })).toBe('{"id":10}')
  })

  it('renders empty state message when rows are empty', () => {
    render(
      <ToolTable
        columns={[
          { id: 'field', header: 'Field' },
          { id: 'value', header: 'Value' },
        ]}
        rows={[]}
        emptyMessage="Nothing to display"
      />
    )

    expect(screen.getByRole('status').textContent).toBe('Nothing to display')
  })

  it('renders rows with a11y label when provided', () => {
    render(
      <ToolTable
        columns={[
          { id: 'field', header: 'Field' },
          { id: 'value', header: 'Value' },
        ]}
        rows={[{ id: 'row-1', cells: ['Name', 'Summer Collection'] }]}
        ariaLabel="Summary table"
      />
    )

    expect(screen.getByRole('table', { name: 'Summary table' })).toBeTruthy()
    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('Summer Collection')).toBeTruthy()
  })
})
