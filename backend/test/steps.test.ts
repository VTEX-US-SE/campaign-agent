import { describe, expect, it } from 'vitest'

import { emptyCampaignState } from '../src/campaign.js'
import { campaignSteps } from '../src/steps.js'
import type { Conversation } from '../src/store.js'

const plan = {
  name: 'Black Friday',
  slug: 'black-friday',
  theme: 'Shoes',
  discountPercent: 20,
  beginDate: '2026-11-20',
  endDate: '2026-11-30',
  products: [],
}

function conversation(): Conversation {
  return {
    id: 'c1',
    account: 'primegoods',
    summary: '',
    createdAt: '',
    updatedAt: '',
    timeline: [],
    history: [],
    state: emptyCampaignState(),
    processedMessageIds: [],
  }
}

describe('campaignSteps', () => {
  it('lists all steps as pending before a plan exists', () => {
    const result = campaignSteps(conversation(), false)
    expect(result.plan).toBeNull()
    expect(result.steps.map((s) => s.status)).toEqual(['pending', 'pending', 'pending', 'pending', 'pending'])
  })

  it('links created resources and marks the next step as running during a turn', () => {
    const conv = conversation()
    conv.state.confirmedPlan = plan
    conv.state.collection = { id: 147, subcollectionId: 13, name: 'Black Friday', skuCount: 3 }
    const result = campaignSteps(conv, true)

    expect(result.steps[0]).toMatchObject({
      status: 'done',
      url: 'https://primegoods.myvtex.com/admin/collections/147',
      detail: '#147 · 3 SKUs',
    })
    expect(result.steps[1].status).toBe('running')
    expect(result.steps[2].status).toBe('pending')
  })

  it('links the landing page to the CMS entry, not a storefront preview', () => {
    const conv = conversation()
    conv.state.confirmedPlan = plan
    conv.state.landingPage = {
      entryId: 'e1',
      slug: 'black-friday',
      branch: 'Gartner Symposium',
      cmsUrl: 'https://primegoods.myvtex.com/admin/content-platform/branches/b1/form/faststore/landingPage/entries/e1',
      previewUrl: 'https://primegoods.vtex.app/api/preview?documentId=e1',
    }
    const step = campaignSteps(conv, false).steps.find((s) => s.id === 'create_landing_page')
    expect(step?.url).toContain('/admin/content-platform/')
    expect(step?.detail).toBe('/black-friday · Gartner Symposium')
  })

  it('shows the error of a failed step once the turn ends', () => {
    const conv = conversation()
    conv.state.confirmedPlan = plan
    conv.timeline.push({
      event: 'message',
      type: 'tool',
      messageId: 'm1',
      parentMessageId: 'm1',
      createdAt: '',
      role: 'assistant',
      data: { name: 'create_collection', status: 'success', output: { status: 'error', message: 'Forbidden' } },
    })
    expect(campaignSteps(conv, false).steps[0]).toMatchObject({ status: 'failed', error: 'Forbidden' })
  })
})
