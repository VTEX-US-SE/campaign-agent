import type { FunctionDeclaration } from '@google/genai'

import { createCollectionTool, createPromotionTool } from './campaign.js'
import { previewCollectionProductsTool, searchProductsTool } from './catalog.js'
import { generateBannersTool, generateCampaignContentTool } from './content.js'
import { confirmActionTool, optionPickerTool } from './interaction.js'
import { createLandingPageTool } from './landingPage.js'
import type { AgentTool } from './types.js'

export const tools: AgentTool<any>[] = [
  searchProductsTool,
  previewCollectionProductsTool,
  optionPickerTool,
  confirmActionTool,
  createCollectionTool,
  createPromotionTool,
  generateCampaignContentTool,
  generateBannersTool,
  createLandingPageTool,
]

export const toolsByName = new Map(tools.map((tool) => [tool.name, tool]))

export function functionDeclarations(): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.parameters,
  }))
}
