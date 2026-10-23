export interface ProductSummary {
  productId: number
  productName: string
  brand?: string
  categories?: string[]
  skuIds: number[]
  imageUrl?: string | null
  price?: number | null
}

export interface CampaignPlan {
  name: string
  slug: string
  theme: string
  discountPercent: number
  beginDate: string
  endDate: string
  products: ProductSummary[]
}

export interface CampaignContent {
  headline: string
  subheadline: string
  sentences: string[]
  cta: { label: string; url?: string }
  seo: { title: string; description: string }
  bannerPrompt?: string
}

export interface CampaignBanner {
  id: string
  label: string
  aspectRatio: string
  url: string
  localPath?: string
  mimeType: string
}

export interface CampaignState {
  searchResults: Record<string, ProductSummary>
  selectedProducts?: ProductSummary[]
  draft?: CampaignPlan
  pendingConfirmation?: { token: string; plan: CampaignPlan }
  confirmedPlan?: CampaignPlan
  collection?: { id: number; subcollectionId: number; name: string; skuCount: number }
  promotion?: { id: string; name: string }
  content?: CampaignContent
  banners?: CampaignBanner[]
  landingPage?: { entryId?: string; slug: string; branch?: string; previewUrl?: string | null; cmsUrl?: string | null }
}

export function emptyCampaignState(): CampaignState {
  return { searchResults: {} }
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
