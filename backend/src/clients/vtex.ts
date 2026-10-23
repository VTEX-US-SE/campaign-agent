import type { CampaignPlan, ProductSummary } from '../campaign.js'
import { type RequestContext, vtexFetch } from '../context.js'
import { buildCollectionPayload, buildPromotionPayload, buildSubcollectionPayload } from './payloads.js'

interface CatalogSearchProduct {
  productId: string
  productName: string
  brand?: string
  categories?: string[]
  items?: Array<{
    itemId: string
    images?: Array<{ imageUrl?: string }>
    sellers?: Array<{ commertialOffer?: { Price?: number; AvailableQuantity?: number } }>
  }>
}

export function toProductSummary(product: CatalogSearchProduct): ProductSummary {
  const items = product.items ?? []
  const firstOffer = items[0]?.sellers?.[0]?.commertialOffer
  return {
    productId: Number(product.productId),
    productName: product.productName,
    brand: product.brand,
    categories: product.categories,
    skuIds: items.map((item) => Number(item.itemId)).filter(Number.isFinite),
    imageUrl: items[0]?.images?.[0]?.imageUrl ?? null,
    price: firstOffer?.Price ?? null,
  }
}

const PAGE_SIZE = 50

/** Full-text catalog search, optionally narrowed by brand or category name. */
export async function searchProducts(
  ctx: RequestContext,
  params: { query?: string; brand?: string; category?: string; limit?: number },
): Promise<ProductSummary[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200)
  const brand = params.brand?.toLowerCase()
  const category = params.category?.toLowerCase()
  const results: ProductSummary[] = []

  for (let from = 0; results.length < limit && from < 2500; from += PAGE_SIZE) {
    const qs = [`_from=${from}`, `_to=${from + PAGE_SIZE - 1}`]
    // encodeURIComponent uses %20. URLSearchParams uses "+", and this catalog rejects "+" as "Scripts are not allowed".
    if (params.query) qs.push(`ft=${encodeURIComponent(params.query)}`)
    const page = await vtexFetch<CatalogSearchProduct[]>(ctx, `/api/catalog_system/pub/products/search?${qs.join('&')}`)
    if (!Array.isArray(page) || page.length === 0) break

    for (const product of page) {
      if (brand && !product.brand?.toLowerCase().includes(brand)) continue
      if (category && !product.categories?.some((c) => c.toLowerCase().includes(category))) continue
      results.push(toProductSummary(product))
      if (results.length >= limit) break
    }
    if (page.length < PAGE_SIZE) break
  }
  return results
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++
      results[current] = await fn(items[current])
    }
  })
  await Promise.all(workers)
  return results
}

export async function createCollection(ctx: RequestContext, plan: CampaignPlan) {
  const payload = buildCollectionPayload(plan)
  const collection = await vtexFetch<{ Id: number; Name: string }>(ctx, '/api/catalog/pvt/collection', {
    method: 'POST',
    json: payload,
  })
  const subcollection = await vtexFetch<{ Id: number }>(ctx, '/api/catalog/pvt/subcollection', {
    method: 'POST',
    json: buildSubcollectionPayload(collection.Id, plan),
  })

  const skuIds = [...new Set(plan.products.flatMap((p) => p.skuIds))]
  const failures: Array<{ skuId: number; error: string }> = []
  await mapWithConcurrency(skuIds, 5, async (skuId) => {
    try {
      await vtexFetch(ctx, `/api/catalog/pvt/subcollection/${subcollection.Id}/stockkeepingunit`, {
        method: 'POST',
        json: { SkuId: skuId },
      })
    } catch (error) {
      failures.push({ skuId, error: (error as Error).message })
    }
  })

  const added = skuIds.filter((skuId) => !failures.some((failure) => failure.skuId === skuId))
  // Products added through the API stay out of search until the collection is saved again.
  await publishCollectionForSearch(ctx, collection.Id, payload, added)

  return {
    id: collection.Id,
    name: collection.Name ?? plan.name,
    subcollectionId: subcollection.Id,
    skuCount: added.length,
    failures,
  }
}

/** Asks Catalog to index the new collection so the landing page shelf can list its products. */
async function publishCollectionForSearch(
  ctx: RequestContext,
  collectionId: number,
  payload: ReturnType<typeof buildCollectionPayload>,
  skuIds: number[],
) {
  try {
    await vtexFetch(ctx, `/api/catalog/pvt/collection/${collectionId}`, { method: 'PUT', json: payload })
  } catch {
    // The collection already exists. A failed refresh only delays the shelf.
  }
  await mapWithConcurrency(skuIds, 5, async (skuId) => {
    try {
      await vtexFetch(ctx, `/api/catalog_system/pvt/skuseller/changenotification/${skuId}`, {
        method: 'POST',
        json: {},
      })
    } catch {
      // Indexing also runs on its own. The shelf may take longer to fill.
    }
  })
}

export async function createPromotion(ctx: RequestContext, plan: CampaignPlan, collection: { id: number; name: string }) {
  const promotion = await vtexFetch<{ idCalculatorConfiguration: string; name: string }>(
    ctx,
    '/api/rnb/pvt/calculatorconfiguration',
    { method: 'POST', json: buildPromotionPayload(plan, collection) },
  )
  return { id: promotion.idCalculatorConfiguration, name: promotion.name ?? plan.name }
}
