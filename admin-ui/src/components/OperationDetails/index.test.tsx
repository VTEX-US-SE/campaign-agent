import { cleanup, render, screen } from '@testing-library/react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Shoreline mock — expand to cover all components used by OperationDetails
// ---------------------------------------------------------------------------

vi.mock('@vtex/shoreline', () => {
  const Wrap = ({ children }: { children?: ReactNode }) => <div>{children}</div>

  return {
    Alert: ({ children, variant }: { children?: ReactNode; variant?: string }) => (
      <div data-variant={variant}>{children}</div>
    ),
    Divider: () => <hr />,
    Flex: ({ children, style }: { children?: ReactNode; style?: CSSProperties }) => (
      <div style={style}>{children}</div>
    ),
    Heading: ({ children, level }: { children?: ReactNode; level?: number }) => {
      const Tag = `h${level ?? 2}` as ElementType
      return <Tag>{children}</Tag>
    },
    Stack: ({ children, style }: { children?: ReactNode; style?: CSSProperties }) => (
      <div style={style}>{children}</div>
    ),
    Tag: ({
      children,
      color,
      title,
    }: {
      children?: ReactNode
      color?: string
      title?: string
    }) => (
      <span data-tag data-color={color} title={title}>
        {children}
      </span>
    ),
    Text: ({
      children,
      variant,
      style,
    }: {
      children?: ReactNode
      variant?: string
      style?: CSSProperties
    }) => (
      <span data-variant={variant} style={style}>
        {children}
      </span>
    ),
  }
})

import { OperationDetails } from './index'
import type { OperationDetails as OperationDetailsType } from '../../typings'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDetails(overrides: Partial<OperationDetailsType> = {}): OperationDetailsType {
  return {
    title: "Create collection 'Adidas Store'",
    action_label: 'Create the collection',
    tool_name: 'create_collection',
    fields: [
      { label: 'Name', value: 'Adidas Store', kind: 'text' },
      { label: 'Description', value: 'All adidas products', kind: 'text' },
    ],
    rules: [
      {
        index: 1,
        type: 'inclusive',
        criteria: [
          {
            label: 'Brands',
            kind: 'brand-reference',
            items: [{ id: 42, name: 'Adidas' }],
          },
        ],
      },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OperationDetails', () => {
  it('renders the title', () => {
    render(<OperationDetails details={makeDetails()} />)
    expect(screen.getByText("Create collection 'Adidas Store'")).toBeTruthy()
  })

  it('renders field labels and values', () => {
    render(<OperationDetails details={makeDetails()} />)
    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('Adidas Store')).toBeTruthy()
    expect(screen.getByText('Description')).toBeTruthy()
    expect(screen.getByText('All adidas products')).toBeTruthy()
  })

  it('renders rule type tag', () => {
    render(<OperationDetails details={makeDetails()} />)
    expect(screen.getByText('inclusive')).toBeTruthy()
  })

  it('renders brand reference tags with resolved name', () => {
    render(<OperationDetails details={makeDetails()} />)
    const tag = screen.getByText('Adidas')
    expect(tag).toBeTruthy()
    // id should be available as title for accessibility
    expect((tag.closest('[title]') as HTMLElement | null)?.title).toBe('42')
  })

  it('renders reference item with name=null showing id and unresolved marker', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'inclusive',
          criteria: [
            {
              label: 'Brands',
              kind: 'brand-reference',
              items: [{ id: 999, name: null }],
            },
          ],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    // The id 999 must appear in the DOM
    expect(screen.getByText('999', { exact: false })).toBeTruthy()
    // An "unresolved" marker must be visually present
    expect(screen.getByText('(unresolved)', { exact: false })).toBeTruthy()
  })

  it('renders truncated_count as "and N more"', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'inclusive',
          criteria: [
            {
              label: 'Brands',
              kind: 'brand-reference',
              items: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `Brand ${i + 1}` })),
              truncated_count: 22,
            },
          ],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    expect(screen.getByText('and 22 more', { exact: false })).toBeTruthy()
    // Exactly 50 tag elements should be in the DOM for the criterion
    const tags = screen.getAllByText(/^Brand \d+$/)
    expect(tags.length).toBe(50)
  })

  it('renders all known criterion kinds without crashing', () => {
    const kinds = [
      'brand-reference',
      'category-reference',
      'collection-reference',
      'product-reference',
      'sku-reference',
      'product-spec-value-reference',
      'sku-spec-value-reference',
    ] as const

    for (const kind of kinds) {
      const details = makeDetails({
        rules: [
          {
            index: 1,
            type: 'inclusive',
            criteria: [
              {
                label: 'Items',
                kind,
                items: [{ id: 1, name: 'Test' }],
              },
            ],
          },
        ],
      })
      const { unmount } = render(<OperationDetails details={details} />)
      expect(screen.getByText('Test')).toBeTruthy()
      unmount()
    }
  })

  it('sets the chat font family on the card root', () => {
    render(<OperationDetails details={makeDetails()} />)
    const section = document.querySelector('section')
    expect(section).toBeTruthy()
    const root = section?.firstElementChild as HTMLElement | null
    expect(root?.style.fontFamily).toBe('var(--sl-font-family-sans)')
  })

  it('renders inside a bordered card container', () => {
    render(<OperationDetails details={makeDetails()} />)
    const root = document.querySelector('section')?.firstElementChild as HTMLElement | null
    expect(root?.style.border).toContain('var(--sl-color-border-base)')
    expect(root?.style.borderRadius).toBe('var(--sl-border-radius-medium)')
  })

  it('renders field labels as muted captions', () => {
    render(<OperationDetails details={makeDetails()} />)
    const label = screen.getByText('Name')
    expect(label.getAttribute('data-variant')).toBe('caption1')
  })

  it('separates the rules section with a divider and a "Rules" header', () => {
    render(<OperationDetails details={makeDetails()} />)
    expect(document.querySelector('hr')).toBeTruthy()
    expect(screen.getByText('Rules')).toBeTruthy()
  })

  it('omits the divider and "Rules" header when there are no rules', () => {
    render(<OperationDetails details={makeDetails({ rules: [] })} />)
    expect(document.querySelector('hr')).toBeNull()
    expect(screen.queryByText('Rules')).toBeNull()
  })

  it('renders each rule as a soft-background sub-card', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'inclusive',
          criteria: [{ label: 'Brands', kind: 'brand-reference', items: [{ id: 42, name: 'Adidas' }] }],
        },
        {
          index: 2,
          type: 'exclusive',
          criteria: [{ label: 'Categories', kind: 'category-reference', items: [{ id: 10, name: 'Moda' }] }],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    const ruleHeader = screen.getByText('Rule 1')
    const subCard = ruleHeader.closest('div[style]') as HTMLElement | null
    // Walk up to the container carrying the sub-card background.
    let node: HTMLElement | null = subCard
    while (node && !node.style.background) node = node.parentElement
    expect(node?.style.background).toBe('var(--sl-bg-base-soft)')
    expect(screen.getByText('Rule 2')).toBeTruthy()
  })

  it('renders term-filter criterion as a quoted tag, not raw JSON', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'static_filter',
          static: true,
          criteria: [
            {
              label: 'Term',
              kind: 'term-filter',
              items: [{ id: 0, name: 'poá' }],
            },
          ],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    // The criterion label and quoted term render as a proper row.
    expect(screen.getByText('Term')).toBeTruthy()
    expect(screen.getByText(/“poá”/)).toBeTruthy()
    // No warning alert (raw-JSON fallback) must be present.
    expect(document.querySelector('[data-variant="warning"]')).toBeNull()
    expect(document.body.textContent).not.toContain('"kind":"term-filter"')
  })

  it('renders product-text-spec-filter criterion as quoted tags, not raw JSON', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'static_filter',
          static: true,
          criteria: [
            {
              label: 'Product text spec (Cor)',
              kind: 'product-text-spec-filter',
              items: [
                { id: 0, name: 'Verde' },
                { id: 0, name: 'Azul' },
              ],
            },
          ],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    expect(screen.getByText('Product text spec (Cor)')).toBeTruthy()
    expect(screen.getByText(/“Verde”/)).toBeTruthy()
    expect(screen.getByText(/“Azul”/)).toBeTruthy()
    expect(document.querySelector('[data-variant="warning"]')).toBeNull()
    expect(document.body.textContent).not.toContain('"kind":"product-text-spec-filter"')
  })

  it('renders truncated_count on product-text-spec-filter as "and N more"', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'static_filter',
          static: true,
          criteria: [
            {
              label: 'Product text spec (Cor)',
              kind: 'product-text-spec-filter',
              items: Array.from({ length: 50 }, (_, i) => ({ id: 0, name: `v${i + 1}` })),
              truncated_count: 22,
            },
          ],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    expect(screen.getByText('and 22 more', { exact: false })).toBeTruthy()
  })

  it('renders sku-text-spec-filter criterion as quoted tags, not raw JSON', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'static_filter',
          static: true,
          criteria: [
            {
              label: 'SKU text spec (Tamanho)',
              kind: 'sku-text-spec-filter',
              items: [{ id: 0, name: 'M' }],
            },
          ],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    expect(screen.getByText('SKU text spec (Tamanho)')).toBeTruthy()
    expect(screen.getByText(/“M”/)).toBeTruthy()
    expect(document.querySelector('[data-variant="warning"]')).toBeNull()
  })

  it('renders static_filter rule type as a neutral "static filter" tag', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'static_filter',
          static: true,
          criteria: [
            {
              label: 'Term',
              kind: 'term-filter',
              items: [{ id: 0, name: 'Vestido' }],
            },
          ],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    const tag = screen.getByText('static filter')
    expect(tag).toBeTruthy()
    // Neutral color — must not reuse the exclusion red or inclusion green.
    expect((tag.closest('[data-color]') as HTMLElement | null)?.dataset.color).toBe('gray')
    // The raw backend enum value must not leak into the UI.
    expect(screen.queryByText('static_filter')).toBeNull()
  })

  it('renders "active products only" tag for status active_only', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'static_filter',
          static: true,
          status: 'active_only',
          criteria: [{ label: 'Term', kind: 'term-filter', items: [{ id: 0, name: 'Vestido' }] }],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    const tag = screen.getByText('active products only')
    expect(tag).toBeTruthy()
    expect((tag.closest('[data-color]') as HTMLElement | null)?.dataset.color).toBe('gray')
    // The static-filter type tag is still rendered alongside the scope tag.
    expect(screen.getByText('static filter')).toBeTruthy()
    expect(screen.queryByText('active_only')).toBeNull()
  })

  it('renders "active and inactive products" tag in a distinct color for status active_and_inactive', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'static_filter',
          static: true,
          status: 'active_and_inactive',
          criteria: [{ label: 'Term', kind: 'term-filter', items: [{ id: 0, name: 'Vestido' }] }],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    const tag = screen.getByText('active and inactive products')
    expect(tag).toBeTruthy()
    const color = (tag.closest('[data-color]') as HTMLElement | null)?.dataset.color
    // Must stand out from the static gray, inclusive green and exclusive red.
    expect(color).toBe('orange')
    expect(['gray', 'green', 'red']).not.toContain(color)
    expect(screen.queryByText('active_and_inactive')).toBeNull()
    expect(screen.queryByText('active products only')).toBeNull()
  })

  it('renders no status tag when status is absent (dynamic rules)', () => {
    render(<OperationDetails details={makeDetails()} />)
    expect(screen.queryByText('active products only')).toBeNull()
    expect(screen.queryByText('active and inactive products')).toBeNull()
    // Exactly one tag in the rule header: the rule type.
    expect(screen.getByText('inclusive')).toBeTruthy()
  })

  it('ignores an unknown status value instead of rendering it raw', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'static_filter',
          static: true,
          // @ts-expect-error — intentionally invalid status to test forward compatibility
          status: 'future-status',
          criteria: [{ label: 'Term', kind: 'term-filter', items: [{ id: 0, name: 'Vestido' }] }],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    expect(screen.getByText('static filter')).toBeTruthy()
    expect(screen.queryByText('future-status')).toBeNull()
    expect(document.querySelector('[data-variant="warning"]')).toBeNull()
  })

  it('renders static_filter ID criteria as regular reference tags', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'static_filter',
          static: true,
          criteria: [
            {
              label: 'Term',
              kind: 'term-filter',
              items: [{ id: 0, name: 'Vestido' }],
            },
            {
              label: 'Categories',
              kind: 'category-reference',
              items: [{ id: 10, name: 'Moda' }],
            },
          ],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    expect(screen.getByText(/“Vestido”/)).toBeTruthy()
    expect(screen.getByText('Moda')).toBeTruthy()
    expect(document.querySelector('[data-variant="warning"]')).toBeNull()
  })

  it('renders unknown kind as a warning alert without crashing', () => {
    const details = makeDetails({
      rules: [
        {
          index: 1,
          type: 'inclusive',
          criteria: [
            {
              label: 'Mystery',
              // @ts-expect-error — intentionally invalid kind to test fallback
              kind: 'future-kind-that-does-not-exist',
              items: [{ id: 1, name: 'X' }],
            },
          ],
        },
      ],
    })
    render(<OperationDetails details={details} />)
    // Warning alert must be present
    const alert = document.querySelector('[data-variant="warning"]')
    expect(alert).toBeTruthy()
    // Component must not have thrown
  })

  it('renders count kind with numeric value', () => {
    const details = makeDetails({
      fields: [{ label: 'Rows', value: 42, kind: 'count' }],
      rules: [],
    })
    render(<OperationDetails details={details} />)
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('handles empty fields and rules arrays without crashing', () => {
    const details = makeDetails({ fields: [], rules: [] })
    render(<OperationDetails details={details} />)
    // Title still renders
    expect(screen.getByText("Create collection 'Adidas Store'")).toBeTruthy()
  })

  it('handles missing rules key without crashing', () => {
    const details = makeDetails({ rules: undefined })
    render(<OperationDetails details={details} />)
    expect(screen.getByText("Create collection 'Adidas Store'")).toBeTruthy()
  })
})
