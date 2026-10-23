import { HttpError } from '../context.js'
import { createEntry } from '../clients/cms.js'
import { buildLandingPageData } from '../clients/cmsPayloads.js'
import { type AgentTool, failure, success } from './types.js'

interface LandingPageArgs {
  branch?: string
}

export const createLandingPageTool: AgentTool<LandingPageArgs> = {
  name: 'create_landing_page',
  description:
    'Create and save the campaign landing page in the VTEX CMS branch, using the generated copy, banners and the collection shelf. Returns the link to the entry in the CMS. Requires create_collection, generate_campaign_content and generate_banners.',
  parameters: {
    type: 'object',
    properties: {
      branch: {
        type: 'string',
        description: 'CMS branch name given by the user. Omit to use the default configured branch.',
      },
    },
  },
  async handler(args, { ctx, conversation }) {
    const { confirmedPlan: plan, content, banners, collection } = conversation.state
    if (!plan) return failure('The campaign has not been confirmed yet.', 'NOT_CONFIRMED')
    if (!collection) return failure('Create the collection first (create_collection).', 'NO_COLLECTION')
    if (!content) return failure('Generate the campaign content first (generate_campaign_content).', 'NO_CONTENT')
    if (!banners?.length) return failure('Generate the banners first (generate_banners).', 'NO_BANNERS')

    const branch = args.branch ?? process.env.CMS_BRANCH
    if (!branch) {
      return failure('Which CMS branch should the landing page be saved in? Ask the user for the branch name.', 'NO_BRANCH')
    }
    const existing = conversation.state.landingPage
    if (existing?.entryId) {
      return success('The landing page already exists for this campaign', {
        title: plan.name,
        slug: existing.slug,
        branch: existing.branch,
        entryId: existing.entryId,
        cmsUrl: existing.cmsUrl,
      })
    }

    const contentType = process.env.CMS_CONTENT_TYPE ?? 'landingPage'
    const save = (includeSeo: boolean) =>
      createEntry(ctx, {
        branch,
        contentType,
        entryName: plan.name,
        slug: plan.slug,
        data: buildLandingPageData(plan, content, banners, collection.id, { includeSeo }),
        message: `Campaign "${plan.name}" landing page`,
      })

    let result: Awaited<ReturnType<typeof save>>
    try {
      result = await save(true)
    } catch (error) {
      // Branches on a schema without the `seo` object reject unknown fields.
      if (!(error instanceof HttpError) || ![400, 422].includes(error.status)) throw error
      result = await save(false)
    }

    conversation.state.landingPage = {
      entryId: result.entryId,
      slug: plan.slug,
      branch: result.branch.name,
      previewUrl: result.previewUrl,
      cmsUrl: result.cmsUrl,
    }
    return success(`Landing page saved in branch "${result.branch.name}"`, {
      title: plan.name,
      slug: plan.slug,
      branch: result.branch.name,
      entryId: result.entryId,
      cmsUrl: result.cmsUrl,
    })
  },
}
