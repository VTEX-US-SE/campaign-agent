import { describe, expect, it } from 'vitest'

import {
  formatCollectionCount,
  formatDateTime,
  normalizeKeys,
  toDisplayLabel,
  yesNo,
} from './utils'

describe('component utils', () => {
  it('formats labels from different key styles', () => {
    expect(toDisplayLabel('collection_id')).toBe('Collection ID')
    expect(toDisplayLabel('collectionId')).toBe('Collection ID')
    expect(toDisplayLabel('SubCollectionId')).toBe('Sub Collection ID')
    expect(toDisplayLabel('skuId')).toBe('SKU ID')
  })

  it('normalizes object keys recursively', () => {
    expect(
      normalizeKeys({
        collection_id: 10,
        nested_value: { skuId: 11 },
      })
    ).toEqual({
      'Collection ID': 10,
      'Nested Value': { 'SKU ID': 11 },
    })
  })

  it('formats dates and fallbacks', () => {
    expect(formatDateTime()).toBe('-')
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
    expect(formatDateTime('2025-01-20T10:00:00.000Z')).not.toBe('-')
  })

  it('formats collection count and yes/no values', () => {
    expect(formatCollectionCount([1, 2, 3])).toBe(3)
    expect(formatCollectionCount(undefined)).toBe('-')
    expect(yesNo(true)).toBe('Yes')
    expect(yesNo(false)).toBe('No')
  })
})
