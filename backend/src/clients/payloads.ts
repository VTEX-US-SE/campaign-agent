import type { CampaignPlan } from '../campaign.js'

/** Converts a `YYYY-MM-DD` (or full ISO) date into an ISO timestamp. End dates run until the end of the day. */
export function toIsoDate(date: string, endOfDay = false): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}.000Z`
  }
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${date}`)
  return parsed.toISOString()
}

export function buildCollectionPayload(plan: CampaignPlan, now = new Date()) {
  const campaignStart = new Date(toIsoDate(plan.beginDate))
  // The shelf filters by this collection, and VTEX hides collections whose start date
  // is still in the future. Start it immediately so the preview shows products.
  // The promotion keeps the campaign dates, so the discount still begins on time.
  const dateFrom = campaignStart.getTime() > now.getTime() ? new Date(now.getTime() - 60_000) : campaignStart
  return {
    Name: plan.name,
    Description: plan.theme,
    Searchable: true,
    Highlight: false,
    DateFrom: dateFrom.toISOString(),
    DateTo: toIsoDate(plan.endDate, true),
  }
}

export function buildSubcollectionPayload(collectionId: number, plan: CampaignPlan) {
  return {
    CollectionId: collectionId,
    Name: `${plan.name} - products`,
    Type: 'Inclusive',
    PreSale: false,
    Release: false,
  }
}

export function buildPromotionPayload(plan: CampaignPlan, collection: { id: number; name: string }) {
  if (!(plan.discountPercent > 0 && plan.discountPercent < 100)) {
    throw new Error(`Discount must be between 0 and 100, got ${plan.discountPercent}`)
  }
  return {
    name: plan.name,
    description: plan.theme,
    beginDateUtc: toIsoDate(plan.beginDate),
    endDateUtc: toIsoDate(plan.endDate, true),
    isActive: true,
    isArchived: false,
    isFeatured: true,
    type: 'regular',
    origin: 'Marketplace',
    cumulative: false,
    accumulateWithManualPrices: false,
    nominalDiscountValue: 0,
    percentualDiscountValue: plan.discountPercent,
    maximumUnitPriceDiscount: 0,
    collections: [{ id: String(collection.id), name: collection.name }],
    collectionsIsInclusionList: true,
    activeDaysOfWeek: [],
    paymentsMethods: [],
    idsSalesChannel: [],
    areSalesChannelIdsExclusive: false,
  }
}
