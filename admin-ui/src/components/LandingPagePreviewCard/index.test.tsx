import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@vtex/agentic-ui', () => ({}))

vi.mock('@vtex/shoreline', () => {
  const Wrap = ({ children }: { children: ReactNode }) => <div>{children}</div>
  return {
    Alert: Wrap,
    Flex: Wrap,
    Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
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

import { LandingPagePreviewCard } from './index'

describe('LandingPagePreviewCard', () => {
  it('links to the CMS entry without a storefront preview', () => {
    render(
      <LandingPagePreviewCard
        {...({
          data: {
            output: {
              status: 'success',
              message: 'Landing page saved in branch "black-friday"',
              data: {
                title: 'Black Friday',
                slug: 'black-friday',
                branch: 'black-friday',
                entryId: 'entry-1',
                cmsUrl: 'https://primegoods.myvtex.com/admin/content-platform',
              },
            },
          },
        } as any)}
      />,
    )

    expect(screen.getByText('/black-friday')).toBeTruthy()
    expect(screen.getByText('Open in CMS')).toBeTruthy()
    expect(screen.queryByText('Open preview')).toBeNull()
    expect(screen.queryByTitle('Landing page preview')).toBeNull()
  })
})
