import { searchProducts } from '../clients/vtex.js'
import { type AgentTool, failure, success } from './types.js'

interface SearchArgs {
  query?: string
  brand?: string
  category?: string
  limit?: number
}

export const searchProductsTool: AgentTool<SearchArgs> = {
  name: 'search_products',
  description:
    'Search the VTEX catalog once for products matching the campaign. Use a short keyword query (e.g. "running shoes") and optionally filter by brand or category name. Returns product IDs to use in preview_collection_products. Do not call this again when the results already match the request.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Full-text keywords. Leave empty to browse by brand/category only.' },
      brand: { type: 'string', description: 'Brand name filter (partial match).' },
      category: { type: 'string', description: 'Category name filter (partial match).' },
      limit: { type: 'integer', description: 'Maximum number of products (1-200, default 50).' },
    },
  },
  async handler(args, { ctx, conversation }) {
    const products = await searchProducts(ctx, args)
    for (const product of products) {
      conversation.state.searchResults[String(product.productId)] = product
    }
    const queryLabel = [args.query, args.brand && `brand: ${args.brand}`, args.category && `category: ${args.category}`]
      .filter(Boolean)
      .join(', ')
    return success(`Found ${products.length} product(s)`, {
      title: 'Product search',
      query: queryLabel || 'all products',
      total: products.length,
      emptyMessage: 'No products matched this search. Try broader keywords.',
      items: products.map((product) => ({
        id: product.productId,
        name: product.brand ? `${product.productName} (${product.brand})` : product.productName,
        skus: product.skuIds.length,
        price: product.price,
      })),
    })
  },
}

interface PreviewArgs {
  product_ids: number[]
}

export const previewCollectionProductsTool: AgentTool<PreviewArgs> = {
  name: 'preview_collection_products',
  description:
    'Select the products that will go into the campaign collection and show them to the user. Only use product IDs returned by search_products.',
  parameters: {
    type: 'object',
    properties: {
      product_ids: { type: 'array', items: { type: 'integer' }, description: 'Product IDs to include.' },
    },
    required: ['product_ids'],
  },
  async handler(args, { conversation }) {
    const ids = [...new Set(args.product_ids ?? [])]
    const products = ids.map((id) => conversation.state.searchResults[String(id)]).filter(Boolean)
    const unknown = ids.filter((id) => !conversation.state.searchResults[String(id)])
    if (products.length === 0) {
      return failure('None of these product IDs came from search_products. Search the catalog first.', 'UNKNOWN_PRODUCTS')
    }
    conversation.state.selectedProducts = products
    return success(
      `${products.length} product(s) selected for the collection${unknown.length ? `; ignored unknown IDs ${unknown.join(', ')}` : ''}`,
      {
        total: products.length,
        page: 1,
        products: products.map((product) => ({
          productId: product.productId,
          skuId: product.skuIds[0],
          productName: product.productName,
          skuImageUrl: product.imageUrl,
        })),
      },
    )
  },
}
