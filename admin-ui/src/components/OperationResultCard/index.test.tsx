import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@vtex/agentic-ui', () => ({}))

vi.mock('@vtex/shoreline', () => {
  const Wrap = ({ children }: { children: ReactNode }) => <div>{children}</div>

  return {
    Alert: Wrap,
    Flex: Wrap,
    Table: ({ children, columnWidths, ...props }: { children: ReactNode; columnWidths?: string[] }) => (
      <table {...props}>{children}</table>
    ),
    TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
    TableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
    TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
    TableHeaderCell: ({ children }: { children: ReactNode }) => <th>{children}</th>,
    TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  }
})

import { OperationResultCard } from './index'

describe('OperationResultCard', () => {
  it('renders normalized labels for successful operations', () => {
    render(
      <OperationResultCard
        {...({
          data: {
            output: {
              status: 'success',
              message: 'Collection updated',
              data: {
                collectionId: 42,
                sku_id: 80,
                nestedData: {
                  already_existed: true,
                },
              },
            },
          },
        } as any)}
      />
    )

    expect(screen.getByText('Collection updated')).toBeTruthy()
    expect(screen.getByText('Collection ID')).toBeTruthy()
    expect(screen.getByText('SKU ID')).toBeTruthy()
    expect(screen.getByText('Nested Data > Already Existed')).toBeTruthy()
  })

  it('renders error feedback when operation fails', () => {
    render(
      <OperationResultCard
        {...({
          data: {
            output: {
              status: 'error',
              message: 'Operation not allowed',
              code: 'FORBIDDEN',
            },
          },
        } as any)}
      />
    )

    expect(screen.getByText('Operation not allowed')).toBeTruthy()
    expect(screen.getByText('Code')).toBeTruthy()
    expect(screen.getByText('FORBIDDEN')).toBeTruthy()
  })
})
