import { adminHost } from '../context.js'
import { createCollection, createPromotion } from '../clients/vtex.js'
import { type AgentTool, failure, success } from './types.js'

const NOT_CONFIRMED = failure(
  'The campaign has not been confirmed yet. Call confirm_action and wait for the user to click "Create campaign".',
  'NOT_CONFIRMED',
)

export const createCollectionTool: AgentTool = {
  name: 'create_collection',
  description: 'Create the confirmed campaign collection in the VTEX catalog with the selected SKUs. Only after the user confirmed.',
  parameters: { type: 'object', properties: {} },
  async handler(_args, { ctx, conversation }) {
    const plan = conversation.state.confirmedPlan
    if (!plan) return NOT_CONFIRMED
    if (conversation.state.collection) {
      const c = conversation.state.collection
      return success('The collection already exists for this campaign', { collectionId: c.id, collectionName: c.name, skusAdded: c.skuCount })
    }
    const collection = await createCollection(ctx, plan)
    conversation.state.collection = {
      id: collection.id,
      subcollectionId: collection.subcollectionId,
      name: collection.name,
      skuCount: collection.skuCount,
    }
    return success(`Collection "${collection.name}" created with ${collection.skuCount} SKU(s)`, {
      collectionId: collection.id,
      collectionName: collection.name,
      subcollectionId: collection.subcollectionId,
      skusAdded: collection.skuCount,
      failedSkus: collection.failures.length ? collection.failures.map((f) => f.skuId).join(', ') : 'none',
      adminUrl: `${adminHost(ctx.account)}/admin/collections/${collection.id}`,
    })
  },
}

export const createPromotionTool: AgentTool = {
  name: 'create_promotion',
  description: 'Create the confirmed percentage promotion scoped to the campaign collection. Requires create_collection first.',
  parameters: { type: 'object', properties: {} },
  async handler(_args, { ctx, conversation }) {
    const plan = conversation.state.confirmedPlan
    if (!plan) return NOT_CONFIRMED
    const collection = conversation.state.collection
    if (!collection) return failure('Create the collection first (create_collection).', 'NO_COLLECTION')
    if (conversation.state.promotion) {
      return success('The promotion already exists for this campaign', { promotionId: conversation.state.promotion.id })
    }
    const promotion = await createPromotion(ctx, plan, collection)
    conversation.state.promotion = promotion
    return success(`Promotion "${promotion.name}" created`, {
      promotionId: promotion.id,
      promotionName: promotion.name,
      discount: `${plan.discountPercent}%`,
      starts: plan.beginDate,
      ends: plan.endDate,
      collection: `${collection.name} (${collection.id})`,
      adminUrl: `${adminHost(ctx.account)}/admin/promotions/${promotion.id}`,
    })
  },
}
