import { describe, expect, it } from 'vitest'

import type { CampaignBanner, CampaignContent, CampaignPlan } from '../src/campaign.js'
import { slugify } from '../src/campaign.js'
import { buildLandingPageData, buildPreviewUrl, serializeCmsArray, timestampIds } from '../src/clients/cmsPayloads.js'
import { publicRawUrl } from '../src/clients/github.js'
import { buildCollectionPayload, buildPromotionPayload, buildSubcollectionPayload, toIsoDate } from '../src/clients/payloads.js'

const plan: CampaignPlan = {
  name: 'Black Friday Running',
  slug: 'black-friday-running',
  theme: 'Running shoes for Black Friday',
  discountPercent: 20,
  beginDate: '2026-11-20',
  endDate: '2026-11-30',
  products: [
    { productId: 1, productName: 'Shoe A', skuIds: [11, 12] },
    { productId: 2, productName: 'Shoe B', skuIds: [21] },
  ],
}

const content: CampaignContent = {
  headline: 'Run Faster',
  subheadline: '20% off running shoes',
  sentences: ['Built for speed.', 'Light and comfortable.', 'Ends Nov 30.'],
  cta: { label: 'Shop now' },
  seo: { title: 'Black Friday Running', description: 'Save 20%' },
}

const banners: CampaignBanner[] = [
  { id: 'desktop', label: 'Desktop banner', aspectRatio: '4:1', url: 'https://cdn/desktop.png', mimeType: 'image/png' },
  { id: 'mobile', label: 'Mobile banner', aspectRatio: '1:1', url: 'https://cdn/mobile.png', mimeType: 'image/png' },
]

function counter() {
  let i = 0
  return () => `id${i++}`
}

describe('catalog and promotion payloads', () => {
  it('converts dates to full-day ISO ranges', () => {
    expect(toIsoDate('2026-11-20')).toBe('2026-11-20T00:00:00.000Z')
    expect(toIsoDate('2026-11-30', true)).toBe('2026-11-30T23:59:59.000Z')
    expect(() => toIsoDate('not a date')).toThrow()
  })

  it('builds the collection and inclusive subcollection', () => {
    expect(buildCollectionPayload(plan, new Date('2026-11-25T12:00:00.000Z'))).toMatchObject({
      Name: 'Black Friday Running',
      Searchable: true,
      DateFrom: '2026-11-20T00:00:00.000Z',
      DateTo: '2026-11-30T23:59:59.000Z',
    })
    const early = new Date(buildCollectionPayload(plan, new Date('2026-10-18T00:00:00.000Z')).DateFrom)
    expect(early.getTime()).toBeLessThan(new Date('2026-10-18T00:00:00.000Z').getTime())
    expect(buildSubcollectionPayload(99, plan)).toMatchObject({ CollectionId: 99, Type: 'Inclusive' })
  })

  it('builds a regular percentage promotion scoped to the collection', () => {
    expect(buildPromotionPayload(plan, { id: 99, name: 'Black Friday Running' })).toMatchObject({
      type: 'regular',
      isActive: true,
      percentualDiscountValue: 20,
      collections: [{ id: '99', name: 'Black Friday Running' }],
      collectionsIsInclusionList: true,
      beginDateUtc: '2026-11-20T00:00:00.000Z',
      endDateUtc: '2026-11-30T23:59:59.000Z',
    })
  })

  it('rejects out-of-range discounts', () => {
    expect(() => buildPromotionPayload({ ...plan, discountPercent: 0 }, { id: 1, name: 'x' })).toThrow()
    expect(() => buildPromotionPayload({ ...plan, discountPercent: 100 }, { id: 1, name: 'x' })).toThrow()
  })

  it('slugifies names', () => {
    expect(slugify('Promoção de Verão 2026!')).toBe('promocao-de-verao-2026')
  })
})

describe('CMS payloads', () => {
  it('serializes arrays as keyed maps with positions', () => {
    expect(serializeCmsArray([{ a: 1 }, { a: 2 }], counter())).toEqual({
      $fnType: 'array',
      values: {
        id0: { a: 1, id: 'id0', $position: 0 },
        id1: { a: 2, id: 'id1', $position: 1 },
      },
    })
  })

  it('builds a landing page from native FastStore sections', () => {
    const data = buildLandingPageData(plan, content, banners, 99, { makeId: counter() })
    expect(data.slug).toBe('black-friday-running')
    expect(data.seo).toMatchObject({ slug: '/black-friday-running', title: 'Black Friday Running', description: 'Save 20%', $componentTitle: 'SEO' })

    const sections = Object.values(data.sections.values).sort((a, b) => (a.$position as number) - (b.$position as number))
    expect(sections.map((s) => s.$componentKey)).toEqual([
      'GartnerSymposiumHero',
      'GartnerSymposiumBannerText',
      'GartnerSymposiumProductShelf',
      'GartnerSymposiumHero',
      'GartnerSymposiumBannerText',
    ])
    expect(sections.at(-1)).toMatchObject({ title: 'Light and comfortable.', caption: 'Ends Nov 30.' })
    expect(sections[0]).toMatchObject({
      title: 'Run Faster',
      image: { src: 'https://cdn/desktop.png' },
      $componentTitle: '[Gartner Symposium] Hero',
    })
    for (const banner of sections.filter((s) => s.$componentKey === 'GartnerSymposiumBannerText')) {
      expect(String(banner.caption).trim()).not.toBe('')
    }

    const shelf = sections[2] as Record<string, any>
    expect(shelf).toMatchObject({ after: '0', sort: 'score_desc' })
    expect(Object.values(shelf.selectedFacets.values)[0]).toMatchObject({ key: 'productClusterIds', value: '99' })
  })

  it('uses timestamp item ids like the CMS editor', () => {
    const data = buildLandingPageData(plan, content, banners, 99, { makeId: timestampIds(1000) })
    const ids = Object.values(data.sections.values).map((s) => s.id)
    expect(ids.every((id) => typeof id === 'number')).toBe(true)
  })

  it('omits SEO when the branch schema does not support it', () => {
    expect(buildLandingPageData(plan, content, banners, 99, { includeSeo: false })).not.toHaveProperty('seo')
  })

  it('builds a public GitHub raw URL for banner images', () => {
    expect(publicRawUrl('VTEX-US-SE/poc-gartner-symposium', 'main', 'campaigns/black-friday/desktop.png')).toBe(
      'https://raw.githubusercontent.com/VTEX-US-SE/poc-gartner-symposium/main/campaigns/black-friday/desktop.png',
    )
  })

  it('builds the preview URL like the CMS Admin', () => {
    const url = new URL(
      buildPreviewUrl('https://primegoods.vtex.app/api/preview', {
        contentType: 'landingPage',
        documentId: 'e1',
        versionId: 'v1',
        slug: '/black-friday-running',
        locale: 'en-US',
      }),
    )
    expect(url.origin + url.pathname).toBe('https://primegoods.vtex.app/api/preview')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      contentType: 'landingPage',
      documentId: 'e1',
      versionId: 'v1',
      locale: 'en-US',
      slug: 'black-friday-running',
    })
  })
})
