import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@vtex/agentic-ui', () => ({}))

vi.mock('@vtex/shoreline', () => {
  const Wrap = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    Flex: Wrap,
    IconArrowUpRightSmall: () => <span />,
    IconCheckCircleFill: () => <span data-testid="done" />,
    IconWarningCircleFill: () => <span data-testid="failed" />,
    Spinner: () => <span data-testid="running" />,
    Text: ({ children, title }: { children: ReactNode; title?: string }) => <span title={title}>{children}</span>,
  }
})

import { CampaignStepsView } from './index'

describe('CampaignStepsView', () => {
  it('links finished steps to the created resources in a new tab', () => {
    render(
      <CampaignStepsView
        data={{
          plan: { name: 'Black Friday', discountPercent: 20, beginDate: '2026-11-20', endDate: '2026-11-30', slug: 'black-friday' },
          confirmed: true,
          steps: [
            { id: 'create_collection', label: 'Create collection', status: 'done', detail: '#147 · 3 SKUs', url: 'https://admin/collections/147' },
            { id: 'create_promotion', label: 'Create promotion', status: 'running' },
            { id: 'create_landing_page', label: 'Create landing page', status: 'pending' },
          ],
        }}
      />,
    )

    const link = screen.getByText('Create collection').closest('a')
    expect(link?.getAttribute('href')).toBe('https://admin/collections/147')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(screen.getByText('Create promotion').closest('a')).toBeNull()
    expect(screen.getByTestId('running')).toBeTruthy()
    expect(screen.getByText(/Black Friday · 20% off/)).toBeTruthy()
  })

  it('reminds the user nothing is created before confirmation', () => {
    render(
      <CampaignStepsView
        data={{
          plan: { name: 'Summer', discountPercent: 15, beginDate: '2026-12-01', endDate: '2026-12-31', slug: 'summer' },
          confirmed: false,
          steps: [{ id: 'create_collection', label: 'Create collection', status: 'pending' }],
        }}
      />,
    )
    expect(screen.getByText('Nothing is created until you confirm the plan.')).toBeTruthy()
  })
})
