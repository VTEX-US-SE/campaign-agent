import { randomUUID } from 'node:crypto'

import { saveAsset } from '../assets.js'
import type { CampaignBanner, CampaignContent, CampaignPlan } from '../campaign.js'
import { generateImage, generateStructured } from '../clients/gemini.js'
import { githubSettings, imageExtension, uploadPublicImage } from '../clients/github.js'
import { type AgentTool, failure, success } from './types.js'

const CONTENT_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'Hero headline, max 8 words.' },
    subheadline: { type: 'string', description: 'Hero subheadline, max 20 words, mentions the discount.' },
    sentences: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 4,
      description: 'Short persuasive landing page sentences (max 25 words each).',
    },
    cta: {
      type: 'object',
      properties: { label: { type: 'string', description: 'Button label, max 4 words.' } },
      required: ['label'],
    },
    seo: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'SEO title, max 60 characters.' },
        description: { type: 'string', description: 'SEO meta description, max 155 characters.' },
      },
      required: ['title', 'description'],
    },
    bannerPrompt: {
      type: 'string',
      description:
        'Art direction for an e-commerce hero banner: scene, products, mood, palette. No text, no logos, leave negative space on the left for the headline.',
    },
  },
  required: ['headline', 'subheadline', 'sentences', 'cta', 'seo', 'bannerPrompt'],
}

function campaignBrief(plan: CampaignPlan) {
  const productNames = plan.products.slice(0, 15).map((p) => p.productName)
  const brands = [...new Set(plan.products.map((p) => p.brand).filter(Boolean))]
  return [
    `Store: PrimeGoods (VTEX e-commerce).`,
    `Campaign: ${plan.name}. Theme: ${plan.theme}.`,
    `Offer: ${plan.discountPercent}% off from ${plan.beginDate} to ${plan.endDate}.`,
    brands.length ? `Brands: ${brands.join(', ')}.` : '',
    `Products: ${productNames.join('; ')}.`,
  ]
    .filter(Boolean)
    .join('\n')
}

function activePlan(state: { confirmedPlan?: CampaignPlan; draft?: CampaignPlan }) {
  return state.confirmedPlan ?? state.draft
}

interface ContentArgs {
  tone?: string
  language?: string
}

export const generateCampaignContentTool: AgentTool<ContentArgs> = {
  name: 'generate_campaign_content',
  description: 'Write the landing page copy (headline, subheadline, sentences, CTA, SEO) for the campaign with Gemini.',
  parameters: {
    type: 'object',
    properties: {
      tone: { type: 'string', description: 'Optional tone of voice, e.g. "energetic", "premium".' },
      language: { type: 'string', description: 'Language of the copy, e.g. "English", "Portuguese". Defaults to the user language.' },
    },
  },
  async handler(args, { ctx, conversation }) {
    const plan = activePlan(conversation.state)
    if (!plan) return failure('There is no campaign plan yet. Select products and call confirm_action first.', 'NO_PLAN')
    const language = args.language ?? (ctx.locale.startsWith('pt') ? 'Portuguese' : ctx.locale.startsWith('es') ? 'Spanish' : 'English')
    const content = await generateStructured<CampaignContent>(
      [
        'You are a senior e-commerce copywriter. Write landing page copy for this campaign.',
        campaignBrief(plan),
        `Language: ${language}. Tone: ${args.tone ?? 'confident, warm and concise'}.`,
        'Do not invent prices or product claims. Mention the discount and the end date where natural.',
      ].join('\n\n'),
      CONTENT_SCHEMA,
    )
    content.cta.url = `/${plan.slug}`
    conversation.state.content = content
    const { bannerPrompt: _bannerPrompt, ...visible } = content
    return success('Landing page copy generated', visible)
  },
}

const BANNER_FORMATS = [
  { id: 'desktop', label: 'Desktop banner', aspectRatio: '4:1', fallback: '21:9' },
  { id: 'mobile', label: 'Mobile banner', aspectRatio: '1:1', fallback: '1:1' },
] as const

interface BannerArgs {
  style?: string
}

export const generateBannersTool: AgentTool<BannerArgs> = {
  name: 'generate_banners',
  description: 'Generate the desktop (4:1) and mobile (1:1) hero banners with Gemini image generation. Requires generate_campaign_content first.',
  parameters: {
    type: 'object',
    properties: {
      style: { type: 'string', description: 'Optional visual style override, e.g. "minimal studio photography".' },
    },
  },
  async handler(args, { conversation }) {
    const plan = activePlan(conversation.state)
    const content = conversation.state.content
    if (!plan || !content) return failure('Generate the campaign content first (generate_campaign_content).', 'NO_CONTENT')

    const basePrompt = [
      'Photorealistic e-commerce hero banner for an online store campaign.',
      content.bannerPrompt,
      args.style ? `Visual style: ${args.style}.` : '',
      `Campaign theme: ${plan.theme}.`,
      'No text, no letters, no logos, no watermarks. Clean composition with negative space for a headline overlay.',
    ]
      .filter(Boolean)
      .join(' ')

    const { directory } = githubSettings()
    const banners = await Promise.all(
      BANNER_FORMATS.map(async (format): Promise<CampaignBanner> => {
        const image = await generateImage(`${basePrompt} Format: ${format.id}.`, format.aspectRatio, format.fallback)
        const filename = `${plan.slug}-${format.id}`
        const local = await saveAsset(image.data, image.mimeType, filename)
        const assetPath = `${directory}/${plan.slug}/${format.id}-${randomUUID().slice(0, 8)}.${imageExtension(image.mimeType)}`
        const url = await uploadPublicImage({ data: image.data, mimeType: image.mimeType, path: assetPath })
        return {
          id: format.id,
          label: format.label,
          aspectRatio: format.aspectRatio,
          url,
          localPath: local.localPath,
          mimeType: image.mimeType,
        }
      }),
    )
    conversation.state.banners = banners
    return success(`${banners.length} banners generated`, {
      banners: banners.map(({ id, label, aspectRatio, url }) => ({ id, label, aspectRatio, url })),
    })
  },
}
