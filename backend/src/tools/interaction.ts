import { randomBytes } from 'node:crypto'

import { type CampaignPlan, slugify } from '../campaign.js'
import { toIsoDate } from '../clients/payloads.js'
import { type AgentTool, failure, success } from './types.js'

interface OptionPickerArgs {
  message: string
  options: Array<{ label: string; value: string }>
}

export const optionPickerTool: AgentTool<OptionPickerArgs> = {
  name: 'option_picker',
  description:
    'Ask the user a single clarifying question with 2-5 clickable answers (e.g. discount, dates, product scope). The turn ends after this call; wait for the answer.',
  terminal: true,
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The question to ask.' },
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: { label: { type: 'string' }, value: { type: 'string' } },
          required: ['label', 'value'],
        },
      },
    },
    required: ['message', 'options'],
  },
  async handler(args) {
    if (!args.options?.length) return failure('option_picker needs at least one option')
    return success(args.message, { message: args.message, options: args.options.slice(0, 6) })
  },
}

interface ConfirmArgs {
  name: string
  theme: string
  slug?: string
  discount_percent: number
  begin_date: string
  end_date: string
}

const MAX_REFERENCE_ITEMS = 20

export function confirmationText(token: string) {
  return `Confirm campaign ${token}`
}

export const confirmActionTool: AgentTool<ConfirmArgs> = {
  name: 'confirm_action',
  description:
    'Show the full campaign plan and a confirmation button. Call this once the products are selected (preview_collection_products) and discount and dates are known. Nothing is created in VTEX until the user confirms. The turn ends after this call.',
  terminal: true,
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Campaign name, e.g. "Black Friday Running".' },
      theme: { type: 'string', description: 'One-sentence description of the campaign theme and audience.' },
      slug: { type: 'string', description: 'Landing page slug (kebab-case). Defaults to the slugified name.' },
      discount_percent: { type: 'number', description: 'Percentage discount (1-99).' },
      begin_date: { type: 'string', description: 'Start date, YYYY-MM-DD.' },
      end_date: { type: 'string', description: 'End date, YYYY-MM-DD.' },
    },
    required: ['name', 'theme', 'discount_percent', 'begin_date', 'end_date'],
  },
  async handler(args, { conversation }) {
    const products = conversation.state.selectedProducts ?? []
    if (products.length === 0) {
      return failure('Select the products with preview_collection_products before confirming.', 'NO_PRODUCTS')
    }
    if (!(args.discount_percent > 0 && args.discount_percent < 100)) {
      return failure('The discount must be between 1% and 99%.', 'INVALID_DISCOUNT')
    }
    let begin: string
    let end: string
    try {
      begin = toIsoDate(args.begin_date)
      end = toIsoDate(args.end_date, true)
    } catch (error) {
      return failure((error as Error).message, 'INVALID_DATE')
    }
    if (begin > end) return failure('The start date must be before the end date.', 'INVALID_DATE_RANGE')

    const plan: CampaignPlan = {
      name: args.name.trim(),
      theme: args.theme.trim(),
      slug: slugify(args.slug || args.name),
      discountPercent: args.discount_percent,
      beginDate: args.begin_date,
      endDate: args.end_date,
      products,
    }
    const token = randomBytes(3).toString('hex').toUpperCase()
    conversation.state.pendingConfirmation = { token, plan }
    conversation.state.draft = plan

    const skuCount = new Set(products.flatMap((p) => p.skuIds)).size
    return success('Review the campaign before it is created.', {
      message: `Create campaign "${plan.name}"?`,
      action_label: 'Create campaign',
      confirm_text: confirmationText(token),
      details: {
        title: `Create campaign "${plan.name}"`,
        action_label: 'Create campaign',
        tool_name: 'create_campaign',
        fields: [
          { label: 'Theme', value: plan.theme, kind: 'text' },
          { label: 'Discount', value: `${plan.discountPercent}%`, kind: 'text' },
          { label: 'Starts', value: plan.beginDate, kind: 'text' },
          { label: 'Ends', value: plan.endDate, kind: 'text' },
          { label: 'Landing page', value: `/${plan.slug}`, kind: 'text' },
          { label: 'Products', value: products.length, kind: 'count' },
          { label: 'SKUs', value: skuCount, kind: 'count' },
          {
            label: 'Will create',
            value: 'Collection, promotion, banners, landing page (CMS)',
            kind: 'text',
          },
        ],
        rules: [
          {
            index: 1,
            type: 'inclusive',
            criteria: [
              {
                label: 'Products',
                kind: 'product-reference',
                items: products.slice(0, MAX_REFERENCE_ITEMS).map((p) => ({ id: p.productId, name: p.productName })),
                ...(products.length > MAX_REFERENCE_ITEMS ? { truncated_count: products.length - MAX_REFERENCE_ITEMS } : {}),
              },
            ],
          },
        ],
      },
    })
  },
}
