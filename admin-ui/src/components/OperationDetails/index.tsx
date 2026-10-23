import { Alert, Divider, Flex, Heading, Tag, Text } from '@vtex/shoreline'

import type {
  CriterionDetail,
  OperationDetails as OperationDetailsData,
  ReferenceItem,
  RuleDetail,
} from '../../typings'

interface OperationDetailsProps {
  details: OperationDetailsData
}

// Criterion kinds whose items are free-text values (not entity references),
// rendered as quoted tags — {id: 0, name: <text>}, where id is a sentinel.
const quotedTagKinds = new Set<CriterionDetail['kind']>([
  'term-filter',
  'product-text-spec-filter',
  'sku-text-spec-filter',
])

const referenceKinds = new Set<CriterionDetail['kind']>([
  'brand-reference',
  'category-reference',
  'collection-reference',
  'product-reference',
  'sku-reference',
  'product-spec-value-reference',
  'sku-spec-value-reference',
])

// static_filter is a fixed snapshot of matching products — neither an
// inclusion nor an exclusion rule, so it gets a neutral color and a
// human-readable label instead of the raw backend type string.
const ruleTypePresentation: Record<RuleDetail['type'], { label: string; color: 'green' | 'red' | 'gray' }> = {
  inclusive: { label: 'inclusive', color: 'green' },
  exclusive: { label: 'exclusive', color: 'red' },
  static_filter: { label: 'static filter', color: 'gray' },
}

// Product-status scope of a static filter. The opt-in case gets an attention
// color distinct from the inclusive green / exclusive red / static gray, so
// the widened scope is noticed before the user confirms. Active-only is the
// default and stays neutral, but is still shown so the user learns that
// inactive products are excluded unless they ask otherwise.
const statusPresentation: Record<NonNullable<RuleDetail['status']>, { label: string; color: 'gray' | 'orange' }> = {
  active_only: { label: 'active products only', color: 'gray' },
  active_and_inactive: { label: 'active and inactive products', color: 'orange' },
}

function ReferenceTag({ item }: { item: ReferenceItem }) {
  return (
    <Tag variant="secondary" color={item.name === null ? 'gray' : 'blue'} title={String(item.id)}>
      {item.name ?? `${item.id} (unresolved)`}
    </Tag>
  )
}

function CriterionLabel({ children }: { children: string }) {
  return (
    <Text variant="caption1" style={{ color: 'var(--sl-fg-base-soft)' }}>
      {children}
    </Text>
  )
}

function Criterion({ criterion }: { criterion: CriterionDetail }) {
  // Term/text-spec filters carry free text, not entity references: items
  // hold {id: 0, name: <text>}, so the id is a sentinel and only the quoted
  // text is meaningful to the user.
  if (quotedTagKinds.has(criterion.kind)) {
    return (
      <Flex direction="column" gap="var(--sl-space-1)">
        <CriterionLabel>{criterion.label}</CriterionLabel>
        <Flex wrap="wrap" gap="var(--sl-space-1)">
          {criterion.items.map((item, index) => (
            <Tag key={index} variant="secondary" color="blue">
              &ldquo;{item.name ?? ''}&rdquo;
            </Tag>
          ))}
          {criterion.truncated_count ? (
            <Text variant="caption1" style={{ color: 'var(--sl-fg-base-soft)' }}>
              and {criterion.truncated_count} more
            </Text>
          ) : null}
        </Flex>
      </Flex>
    )
  }

  if (!referenceKinds.has(criterion.kind)) {
    return (
      <Alert variant="warning">
        <code>{JSON.stringify(criterion)}</code>
      </Alert>
    )
  }

  return (
    <Flex direction="column" gap="var(--sl-space-1)">
      <CriterionLabel>{criterion.label}</CriterionLabel>
      <Flex wrap="wrap" gap="var(--sl-space-1)">
        {criterion.items.map((item) => (
          <ReferenceTag key={item.id} item={item} />
        ))}
        {criterion.truncated_count ? (
          <Text variant="caption1" style={{ color: 'var(--sl-fg-base-soft)' }}>
            and {criterion.truncated_count} more
          </Text>
        ) : null}
      </Flex>
    </Flex>
  )
}

function Rule({ rule }: { rule: RuleDetail }) {
  const presentation = ruleTypePresentation[rule.type] ?? { label: rule.type, color: 'gray' as const }
  // Unknown status values (e.g. a newer backend) are dropped rather than
  // rendered raw — the card must never show an unexplained enum string.
  const status = rule.status ? statusPresentation[rule.status] : undefined

  return (
    <Flex
      direction="column"
      gap="var(--sl-space-2)"
      style={{
        background: 'var(--sl-bg-base-soft)',
        borderRadius: 'var(--sl-radius-1)',
        padding: 'var(--sl-space-2) var(--sl-space-3)',
      }}
    >
      <Flex gap="var(--sl-space-2)" align="center">
        <Text variant="emphasis">Rule {rule.index}</Text>
        <Tag variant="secondary" color={presentation.color}>
          {presentation.label}
        </Tag>
        {status ? (
          <Tag variant="secondary" color={status.color}>
            {status.label}
          </Tag>
        ) : null}
      </Flex>
      {rule.criteria.map((criterion, index) => (
        <Criterion key={`${criterion.label}-${index}`} criterion={criterion} />
      ))}
    </Flex>
  )
}

export function OperationDetails({ details }: OperationDetailsProps) {
  return (
    <section aria-label={details.title}>
      <Flex
        direction="column"
        gap="var(--sl-space-4)"
        style={{
          padding: 'var(--sl-space-4)',
          border: '1px solid var(--sl-color-border-base)',
          borderRadius: 'var(--sl-border-radius-medium)',
          background: 'var(--sl-color-bg-base)',
          // Tool components render outside the chat's markdown-styled
          // containers, and Shoreline's default `context` text variant
          // inherits its font — without this the card falls back to the
          // browser default instead of the chat typography.
          fontFamily: 'var(--sl-font-family-sans)',
        }}
      >
        {/* Non-display headings carry no font of their own in the theme, so
            pin the composite token to match the rest of the card. */}
        <Heading level={3} style={{ font: 'var(--sl-text-display-4-font)' }}>
          {details.title}
        </Heading>
        {details.fields.length > 0 ? (
          <Flex direction="column" gap="var(--sl-space-2)">
            {details.fields.map((field) => (
              <Flex key={field.label} justify="space-between" gap="var(--sl-space-3)">
                <Text variant="caption1" style={{ color: 'var(--sl-fg-base-soft)' }}>
                  {field.label}
                </Text>
                <Text variant="body" style={field.kind === 'count' ? { textAlign: 'right' } : undefined}>
                  {field.value === null ? '-' : String(field.value)}
                </Text>
              </Flex>
            ))}
          </Flex>
        ) : null}
        {details.rules?.length ? (
          <Flex direction="column" gap="var(--sl-space-2)">
            <Divider />
            <Text variant="emphasis">Rules</Text>
            {details.rules.map((rule) => (
              <Rule key={rule.index} rule={rule} />
            ))}
          </Flex>
        ) : null}
      </Flex>
    </section>
  )
}
