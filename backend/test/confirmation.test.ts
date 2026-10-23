import { describe, expect, it } from 'vitest'

import { applyConfirmation } from '../src/agent.js'
import { emptyCampaignState } from '../src/campaign.js'
import type { RequestContext } from '../src/context.js'
import type { Conversation } from '../src/store.js'
import { createCollectionTool } from '../src/tools/campaign.js'
import { previewCollectionProductsTool } from '../src/tools/catalog.js'
import { confirmActionTool, confirmationText } from '../src/tools/interaction.js'

const ctx: RequestContext = { account: 'primegoods', token: 't', conversationId: 'c1', messageId: 'm1', locale: 'en-US' }

function conversation(): Conversation {
  const state = emptyCampaignState()
  state.searchResults = {
    '1': { productId: 1, productName: 'Shoe A', skuIds: [11] },
    '2': { productId: 2, productName: 'Shoe B', skuIds: [21, 22] },
  }
  return {
    id: 'c1',
    account: 'primegoods',
    summary: '',
    createdAt: '',
    updatedAt: '',
    timeline: [],
    history: [],
    state,
    processedMessageIds: [],
  }
}

const confirmArgs = {
  name: 'Black Friday Running',
  theme: 'Running shoes',
  discount_percent: 20,
  begin_date: '2026-11-20',
  end_date: '2026-11-30',
}

describe('campaign confirmation flow', () => {
  it('only selects products that came from search results', async () => {
    const conv = conversation()
    const out = await previewCollectionProductsTool.handler({ product_ids: [1, 999] }, { ctx, conversation: conv })
    expect(out.status).toBe('success')
    expect(conv.state.selectedProducts?.map((p) => p.productId)).toEqual([1])

    const none = await previewCollectionProductsTool.handler({ product_ids: [999] }, { ctx, conversation: conv })
    expect(none.status).toBe('error')
  })

  it('requires selected products and valid inputs before confirming', async () => {
    const conv = conversation()
    expect((await confirmActionTool.handler(confirmArgs, { ctx, conversation: conv })).status).toBe('error')

    await previewCollectionProductsTool.handler({ product_ids: [1, 2] }, { ctx, conversation: conv })
    const badDates = await confirmActionTool.handler({ ...confirmArgs, begin_date: '2026-12-01' }, { ctx, conversation: conv })
    expect(badDates.code).toBe('INVALID_DATE_RANGE')
  })

  it('blocks mutations until the user sends the confirmation code', async () => {
    const conv = conversation()
    await previewCollectionProductsTool.handler({ product_ids: [1, 2] }, { ctx, conversation: conv })
    const out = await confirmActionTool.handler(confirmArgs, { ctx, conversation: conv })
    const data = out.data as { confirm_text: string; details: { fields: Array<{ label: string; value: unknown }> } }

    expect(data.details.fields.find((f) => f.label === 'SKUs')?.value).toBe(3)
    expect((await createCollectionTool.handler({}, { ctx, conversation: conv })).code).toBe('NOT_CONFIRMED')

    expect(applyConfirmation(conv, 'yes please')).toBe(false)
    expect(applyConfirmation(conv, data.confirm_text)).toBe(true)
    expect(conv.state.confirmedPlan?.slug).toBe('black-friday-running')
    expect(conv.state.pendingConfirmation).toBeUndefined()
  })

  it('formats the confirmation text with the token', () => {
    expect(confirmationText('ABC123')).toBe('Confirm campaign ABC123')
  })
})
