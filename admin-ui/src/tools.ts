import { registerTool } from '@vtex/agentic-ui'

import { CampaignContentCard } from './components/CampaignContentCard'
import { CollectionActionButton } from './components/CollectionActionButton'
import { CollectionPreviewProductsCard } from './components/CollectionPreviewProductsCard'
import { LandingPagePreviewCard } from './components/LandingPagePreviewCard'
import { LookupResultsCard } from './components/LookupResultsCard'
import { OperationResultCard } from './components/OperationResultCard'
import { OptionPicker } from './components/OptionPicker'

/**
 * Tool-to-component registrations for the Campaign Agent.
 *
 * Each call to registerTool maps a backend tool name to the React component
 * that should render when that tool is invoked during a conversation.
 *
 * This file must be imported (as a side effect) in pages/_app.tsx so that
 * all registrations run before the chat renders any messages.
 */

// Renders a confirmation button inline in the chat when the agent calls
// confirm_action (before creating the collection, promotion and landing page).
registerTool({
  name: 'confirm_action',
  label: 'Campaign action',
  mode: 'inline',
  Component: CollectionActionButton,
})

registerTool({
  name: 'option_picker',
  label: 'Choose an option',
  mode: 'inline',
  Component: OptionPicker,
})

registerTool({
  name: 'search_products',
  label: 'Product results',
  mode: 'inline',
  Component: LookupResultsCard,
})

registerTool({
  name: 'preview_collection_products',
  label: 'Collection preview',
  mode: 'canvas',
  Component: CollectionPreviewProductsCard,
})

registerTool({
  name: 'generate_campaign_content',
  label: 'Campaign content',
  mode: 'inline',
  Component: CampaignContentCard,
})

registerTool({
  name: 'generate_banners',
  label: 'Campaign banners',
  mode: 'inline',
  Component: CampaignContentCard,
})

registerTool({
  name: 'create_landing_page',
  label: 'Landing page',
  mode: 'inline',
  Component: LandingPagePreviewCard,
})

const mutationTools = ['create_collection', 'create_promotion']

mutationTools.forEach((toolName) => {
  registerTool({
    name: toolName,
    label: 'Operation result',
    mode: 'inline',
    Component: OperationResultCard,
  })
})
