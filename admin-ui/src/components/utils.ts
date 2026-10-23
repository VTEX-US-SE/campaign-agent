export const SUMMARY_COLUMN_WIDTHS = ['minmax(180px, 260px)', 'minmax(min-content, auto)']

const ACRONYMS: Record<string, string> = {
  id: 'ID',
  ids: 'IDs',
  sku: 'SKU',
  skus: 'SKUs',
  url: 'URL',
}

export function toDisplayLabel(key: string): string {
  const parts: string[] = []

  for (const segment of key.split('_')) {
    const split = segment
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')

    parts.push(...split.split(' ').filter(Boolean))
  }

  return parts
    .map((part) => {
      const lower = part.toLowerCase()
      return ACRONYMS[lower] ?? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(' ')
}

export function normalizeKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(normalizeKeys)
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        toDisplayLabel(key),
        normalizeKeys(value),
      ])
    )
  }

  return obj
}

export function formatDateTime(value?: string): string {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

export function formatCollectionCount(value: unknown): number | string {
  if (!Array.isArray(value)) return '-'
  return value.length
}

export function yesNo(value?: boolean): string {
  return value ? 'Yes' : 'No'
}
