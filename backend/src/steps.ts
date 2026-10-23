import { adminHost } from './context.js'
import type { Conversation } from './store.js'

export type StepStatus = 'pending' | 'running' | 'done' | 'failed'

export interface CampaignStep {
  id: string
  label: string
  status: StepStatus
  detail?: string
  url?: string
  error?: string
}

export interface CampaignSteps {
  plan: { name: string; discountPercent: number; beginDate: string; endDate: string; slug: string } | null
  confirmed: boolean
  steps: CampaignStep[]
}

const STEPS = [
  { id: 'create_collection', label: 'Create collection' },
  { id: 'create_promotion', label: 'Create promotion' },
  { id: 'generate_campaign_content', label: 'Write landing page copy' },
  { id: 'generate_banners', label: 'Generate banners' },
  { id: 'create_landing_page', label: 'Create landing page' },
] as const

type StepId = (typeof STEPS)[number]['id']

/** Error message of the latest call to `tool`, if that call failed. */
function lastError(conversation: Conversation, tool: string): string | undefined {
  for (let i = conversation.timeline.length - 1; i >= 0; i--) {
    const item = conversation.timeline[i]
    if (item.type !== 'tool') continue
    const data = item.data as { name?: string; output?: { status?: string; message?: string } }
    if (data.name !== tool) continue
    return data.output?.status === 'error' ? data.output.message || 'Failed' : undefined
  }
  return undefined
}

export function campaignSteps(conversation: Conversation, running: boolean): CampaignSteps {
  const { state } = conversation
  const plan = state.confirmedPlan ?? state.pendingConfirmation?.plan ?? state.draft
  const admin = adminHost(conversation.account)

  const done: Record<StepId, Omit<CampaignStep, 'id' | 'label' | 'status'> | null> = {
    create_collection: state.collection
      ? { detail: `#${state.collection.id} · ${state.collection.skuCount} SKUs`, url: `${admin}/admin/collections/${state.collection.id}` }
      : null,
    create_promotion: state.promotion
      ? {
          detail: plan ? `${plan.discountPercent}% off` : state.promotion.name,
          url: `${admin}/admin/promotions/${state.promotion.id}`,
        }
      : null,
    generate_campaign_content: state.content ? { detail: state.content.headline } : null,
    generate_banners: state.banners?.length
      ? { detail: `${state.banners.length} banners`, url: state.banners.find((b) => b.id === 'desktop')?.url ?? state.banners[0].url }
      : null,
    create_landing_page: state.landingPage
      ? {
          detail: `/${state.landingPage.slug}${state.landingPage.branch ? ` · ${state.landingPage.branch}` : ''}`,
          url: state.landingPage.cmsUrl ?? undefined,
        }
      : null,
  }

  let runningAssigned = false
  const steps = STEPS.map(({ id, label }): CampaignStep => {
    const result = done[id]
    if (result) return { id, label, status: 'done', ...result }
    const error = state.confirmedPlan ? lastError(conversation, id) : undefined
    if (error && !running) return { id, label, status: 'failed', error }
    if (running && state.confirmedPlan && !runningAssigned) {
      runningAssigned = true
      return { id, label, status: 'running' }
    }
    return { id, label, status: 'pending' }
  })

  return {
    plan: plan
      ? { name: plan.name, discountPercent: plan.discountPercent, beginDate: plan.beginDate, endDate: plan.endDate, slug: plan.slug }
      : null,
    confirmed: Boolean(state.confirmedPlan),
    steps,
  }
}
