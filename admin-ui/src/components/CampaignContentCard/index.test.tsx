import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@vtex/agentic-ui', () => ({}))

vi.mock('@vtex/shoreline', () => {
  const Wrap = ({ children }: { children: ReactNode }) => <div>{children}</div>
  return {
    Alert: Wrap,
    Flex: Wrap,
    Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
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

import { CampaignContentCard } from './index'

describe('CampaignContentCard', () => {
  it('renders the generated copy and sentences', () => {
    render(
      <CampaignContentCard
        {...({
          data: {
            output: [
              {
                json: {
                  status: 'success',
                  message: 'Landing page copy generated',
                  data: {
                    headline: 'Run Faster',
                    subheadline: '20% off running shoes',
                    sentences: ['Built for speed.', 'Ends Nov 30.'],
                    cta: { label: 'Shop now' },
                  },
                },
              },
            ],
          },
        } as any)}
      />,
    )

    expect(screen.getByText('Campaign content')).toBeTruthy()
    expect(screen.getByText('Run Faster')).toBeTruthy()
    expect(screen.getByText('Shop now')).toBeTruthy()
    expect(screen.getByText('Built for speed.')).toBeTruthy()
  })

  it('renders banner thumbnails', () => {
    render(
      <CampaignContentCard
        {...({
          data: {
            output: {
              status: 'success',
              message: '2 banners generated',
              data: {
                banners: [
                  { id: 'desktop', label: 'Desktop banner', aspectRatio: '4:1', url: 'https://cdn/x.png' },
                  { id: 'mobile', label: 'Mobile banner', aspectRatio: '1:1', url: 'https://cdn/y.png' },
                ],
              },
            },
          },
        } as any)}
      />,
    )

    expect(screen.getByText('Campaign banners')).toBeTruthy()
    expect(screen.getByAltText('Desktop banner').getAttribute('src')).toBe('https://cdn/x.png')
    expect(screen.getByAltText('Mobile banner')).toBeTruthy()
  })

  it('renders an error card when generation fails', () => {
    render(
      <CampaignContentCard
        {...({ data: { output: { status: 'error', message: 'Quota exceeded', data: null } } } as any)}
      />,
    )
    expect(screen.getByText('Quota exceeded')).toBeTruthy()
  })
})
