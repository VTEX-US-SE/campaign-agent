import { createAgent } from '@vtex/agentic-ui'

export const agents = [
  createAgent({
      slug: 'campaign-agent',
      id: 'PGCAMPAIGN',
      apiUrl: process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? '',
      ui: {
        name: 'Campaign Agent',
        title: "Hi, I'm {{name}}!",
        subtitle: 'Describe a campaign in one sentence and I will build it for you.',
        promptSuggestions: [
          {
            title: 'Create a campaign',
            description: 'Collection, promotion, banners and landing page',
            promptText:
              'Create a Black Friday campaign with 20% off on all Nike running shoes from Nov 20 to Nov 30.',
          },
          {
            title: 'Seasonal campaign',
            description: 'Let me pick the products for you',
            promptText: 'Create a summer skincare campaign with 15% off for the next two weeks.',
          },
        ],
      },
      routes: {
        frontend: '/app/campaign-agent',
        threads: '/app/campaign-agent',
        stream: '/api/agent/responses',
        tasks: '/api/conversations',
      },
    })
]
