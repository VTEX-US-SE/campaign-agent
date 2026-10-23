import type { CampaignBanner, CampaignContent, CampaignPlan } from '../campaign.js'

export type CmsSection = { $componentKey: string } & Record<string, unknown>
export type CmsId = string | number

/** Item ids like the CMS editor creates them (millisecond timestamps). */
export function timestampIds(start = Date.now()): () => number {
  let next = start
  return () => next++
}

const COMPONENT_TITLES: Record<string, string> = {
  GartnerSymposiumHero: '[Gartner Symposium] Hero',
  GartnerSymposiumBannerText: '[Gartner Symposium] Banner Text',
  GartnerSymposiumProductShelf: '[Gartner Symposium] Product Shelf',
}

/**
 * Serializes an array the way the CMS stores it (`serializeJson` in the
 * content-platform UI): `{ $fnType: 'array', values: { [id]: { ...item, id, $position } } }`.
 */
export function serializeCmsArray<T extends Record<string, unknown>>(items: T[], makeId: () => CmsId = timestampIds()) {
  const values: Record<string, Record<string, unknown>> = {}
  items.forEach((item, position) => {
    const id = makeId()
    values[String(id)] = { ...item, id, $position: position }
  })
  return { $fnType: 'array', values }
}

/** Landing page built from the Gartner Symposium sections (same fields as Hero, Banner Text, and Product Shelf). */
export function buildLandingPageSections(
  plan: CampaignPlan,
  content: CampaignContent,
  banners: CampaignBanner[],
  collectionId: number,
  makeId: () => CmsId = timestampIds(),
): CmsSection[] {
  const desktop = banners.find((b) => b.id === 'desktop') ?? banners[0]
  const mobile = banners.find((b) => b.id === 'mobile')
  const shelfUrl = `/s?fuzzy=0&operator=and&facets=productClusterIds&productClusterIds=${collectionId}`
  const [firstSentence, ...otherSentences] = content.sentences

  const sections: CmsSection[] = [
    {
      $componentKey: 'GartnerSymposiumHero',
      title: content.headline,
      subtitle: content.subheadline,
      link: { text: content.cta.label, url: shelfUrl, linkTargetBlank: false },
      image: { src: desktop?.url ?? '', alt: content.headline },
      colorVariant: 'main',
      variant: 'primary',
    },
  ]

  if (firstSentence) {
    sections.push({
      $componentKey: 'GartnerSymposiumBannerText',
      title: firstSentence,
      caption: `${plan.discountPercent}% off until ${plan.endDate}`,
      link: { text: content.cta.label, url: shelfUrl, linkTargetBlank: false },
      colorVariant: 'light',
      variant: 'primary',
    })
  }

  sections.push({
    $componentKey: 'GartnerSymposiumProductShelf',
    title: plan.name,
    numberOfItems: Math.min(Math.max(plan.products.length, 4), 20),
    itemsPerPage: 5,
    after: '0',
    sort: 'score_desc',
    selectedFacets: serializeCmsArray([{ key: 'productClusterIds', value: String(collectionId) }], makeId),
    productCardConfiguration: { showDiscountBadge: true, bordered: true },
  })

  if (mobile) {
    sections.push({
      $componentKey: 'GartnerSymposiumHero',
      title: content.cta.label,
      subtitle: `${plan.discountPercent}% off until ${plan.endDate}`,
      link: { text: content.cta.label, url: shelfUrl, linkTargetBlank: false },
      image: { src: mobile.url, alt: content.headline },
      colorVariant: 'accent',
      variant: 'secondary',
    })
  }

  if (otherSentences.length > 0) {
    const [title, ...rest] = otherSentences
    sections.push({
      $componentKey: 'GartnerSymposiumBannerText',
      title,
      // Caption is required by the BannerText schema; an empty one blocks saving in the CMS editor.
      caption: rest.join(' ') || content.subheadline || `${plan.discountPercent}% off until ${plan.endDate}`,
      link: { text: content.cta.label, url: shelfUrl, linkTargetBlank: false },
      colorVariant: 'main',
      variant: 'secondary',
    })
  }

  return sections.map((section) => ({ ...section, $componentTitle: COMPONENT_TITLES[section.$componentKey] ?? section.$componentKey }))
}

/**
 * Entry data in the shape the CMS editor saves: page `slug` without a leading slash,
 * `seo.slug` with one, and editor metadata (`$componentTitle`, `siteMap`). Entries saved
 * with a leading-slash `slug` crash the editor form and the branch preview.
 */
export function buildLandingPageData(
  plan: CampaignPlan,
  content: CampaignContent,
  banners: CampaignBanner[],
  collectionId: number,
  { includeSeo = true, makeId = timestampIds() }: { includeSeo?: boolean; makeId?: () => CmsId } = {},
) {
  const slug = plan.slug.replace(/^\/+/, '')
  return {
    slug,
    siteMap: true,
    ...(includeSeo
      ? {
          seo: {
            slug: `/${slug}`,
            title: content.seo.title,
            titleTemplate: '%s | PrimeGoods',
            description: content.seo.description,
            canonical: '',
            $componentTitle: 'SEO',
          },
        }
      : {}),
    sections: serializeCmsArray(buildLandingPageSections(plan, content, banners, collectionId, makeId), makeId),
  }
}

export function buildPreviewUrl(
  basePreviewUrl: string,
  params: { contentType: string; documentId: string; versionId?: string; slug?: string; locale?: string },
): string {
  const url = new URL(basePreviewUrl)
  url.searchParams.append('contentType', params.contentType)
  url.searchParams.append('documentId', params.documentId)
  if (params.versionId) url.searchParams.append('versionId', params.versionId)
  if (params.locale?.trim()) url.searchParams.set('locale', params.locale.trim())
  const slug = params.slug?.trim().replace(/^\/+/g, '')
  if (slug) url.searchParams.set('slug', slug)
  return url.toString()
}
