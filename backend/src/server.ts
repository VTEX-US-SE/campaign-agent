import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import express, { type Request } from 'express'

import { runTurn } from './agent.js'
import type { RequestContext } from './context.js'
import { emptyCampaignState } from './campaign.js'
import { SseWriter, textEnvelope } from './protocol.js'
import { campaignSteps } from './steps.js'
import {
  ARTIFACTS_DIR,
  ASSETS_DIR,
  type Conversation,
  ensureDataDirs,
  listConversations,
  loadConversation,
  loadOrCreateConversation,
  saveConversation,
} from './store.js'

function emptyConversation(id: string, account: string): Conversation {
  const now = new Date().toISOString()
  return { id, account, summary: '', createdAt: now, updatedAt: now, timeline: [], history: [], state: emptyCampaignState(), processedMessageIds: [] }
}

const app = express()
const PORT = Number(process.env.PORT ?? 8009)

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function readCookie(req: Request, name: string): string | undefined {
  const cookie = header(req, 'cookie') ?? ''
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined
}

function auth(req: Request) {
  const query = req.query as Record<string, string | undefined>
  const account = header(req, 'x-vtex-client-account') ?? query.account ?? process.env.VTEX_ACCOUNT
  const token = header(req, 'x-vtex-client-token') ?? query.token ?? readCookie(req, 'VtexIdclientAutCookie')
  return { account, token }
}

interface InputBlock {
  type: string
  text?: string
  name?: string
  _meta?: { artifact_id?: string }
}

async function artifactText(artifactId: string): Promise<string | null> {
  if (!/^[\w-]+$/.test(artifactId)) return null
  const dir = path.join(ARTIFACTS_DIR, artifactId)
  const files = await fs.readdir(dir).catch(() => [] as string[])
  const file = files.find((f) => f !== 'meta.json')
  if (!file || !file.toLowerCase().endsWith('.csv')) return null
  const text = await fs.readFile(path.join(dir, file), 'utf8')
  return text.slice(0, 20000)
}

async function inputsToText(inputs: InputBlock[]): Promise<string> {
  const parts: string[] = []
  for (const block of inputs) {
    if (block.type === 'text' && block.text) parts.push(block.text)
    if (block.type === 'resource_link') {
      const content = block._meta?.artifact_id ? await artifactText(block._meta.artifact_id) : null
      parts.push(
        content
          ? `[Attached file: ${block.name}]\n${content}`
          : `[Attached file: ${block.name} (only CSV contents can be read)]`,
      )
    }
  }
  return parts.join('\n\n')
}

const runningMessages = new Set<string>()
// Conversations mid-turn; their progress is only written to disk when the turn ends.
const activeConversations = new Map<string, Conversation>()

app.get('/v1/agent/responses', async (req, res) => {
  const query = req.query as Record<string, string | undefined>
  const { account, token } = auth(req)
  const conversationId = query.conversation_id
  const messageId = query.message_id
  const writer = new SseWriter(res)

  const fail = (text: string) => {
    const base = { messageId: messageId ?? randomUUID(), parentMessageId: messageId ?? '', conversationId: conversationId ?? '' }
    writer.send(textEnvelope(base, text))
    writer.send(textEnvelope(base, '', 'ui.final'))
    writer.end()
  }

  if (!account || !token) return fail('Missing VTEX credentials. Open the agent from the VTEX Admin.')
  if (!conversationId || !messageId) return fail('Missing conversation_id or message_id.')

  let inputs: InputBlock[] = []
  try {
    inputs = JSON.parse(query.inputs ?? '[]')
  } catch {
    return fail('Invalid inputs payload.')
  }
  const userText = await inputsToText(inputs)
  if (!userText.trim()) return fail('Please type a message.')

  const conversation = await loadOrCreateConversation(conversationId, account, userText)

  // The SSE client reconnects when a stream drops; never run the same message twice.
  const runKey = `${conversationId}:${messageId}`
  if (runningMessages.has(runKey) || conversation.processedMessageIds.includes(messageId)) {
    const base = { messageId, parentMessageId: messageId, conversationId }
    writer.send(textEnvelope(base, '', 'ui.final'))
    return writer.end()
  }
  runningMessages.add(runKey)

  conversation.processedMessageIds.push(messageId)
  conversation.timeline.push({
    event: 'message',
    type: 'text',
    messageId,
    parentMessageId: messageId,
    createdAt: new Date().toISOString(),
    role: 'user',
    data: { text: { value: userText } },
  })

  const ctx: RequestContext = {
    account,
    token,
    conversationId,
    messageId,
    locale: query.locale ?? 'en-US',
  }

  activeConversations.set(conversationId, conversation)
  try {
    await runTurn({ ctx, conversation, userText, writer })
  } finally {
    activeConversations.delete(conversationId)
    runningMessages.delete(runKey)
    await saveConversation(conversation).catch((error) => console.error('[store]', error))
    writer.end()
  }
})

app.get('/v1/conversations', async (req, res) => {
  const { account } = auth(req)
  if (!account) return res.status(401).json({ error: 'Missing account' })
  const limit = Number(header(req, 'limit') ?? (req.query.limit as string | undefined) ?? 100) || 100
  res.json({ items: await listConversations(account, limit) })
})

app.get('/v1/conversations/:id/timeline', async (req, res) => {
  const { account } = auth(req)
  const conversation = await loadConversation(req.params.id).catch(() => null)
  if (!conversation || (account && conversation.account !== account)) return res.json({ items: [] })
  res.json({ items: conversation.timeline })
})

app.get('/v1/conversations/:id/campaign', async (req, res) => {
  const { account } = auth(req)
  const active = activeConversations.get(req.params.id)
  const conversation = active ?? (await loadConversation(req.params.id).catch(() => null))
  if (!conversation || (account && conversation.account !== account)) {
    return res.json({ plan: null, confirmed: false, steps: campaignSteps(emptyConversation(req.params.id, account ?? ''), false).steps })
  }
  res.json(campaignSteps(conversation, Boolean(active)))
})

app.patch('/v1/conversations/:id/messages/:messageId', express.json(), async (req, res) => {
  const conversation = await loadConversation(req.params.id).catch(() => null)
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
  const item = conversation.timeline.find((t) => t.role === 'user' && t.messageId === req.params.messageId)
  if (item) {
    item.metadata = { ...(item.metadata ?? {}), ...(req.body?.metadata ?? {}) }
    await saveConversation(conversation)
  }
  res.json({ ok: true })
})

// Minimal stand-in for the Artifacts service used by the copied upload BFF route.
app.post('/v1/uploads/initiate', express.json(), async (req, res) => {
  const uploadId = randomUUID()
  const dir = path.join(ARTIFACTS_DIR, uploadId)
  await fs.mkdir(dir, { recursive: true })
  const filename = path.basename(String(req.body?.filename ?? 'upload.bin'))
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify({ ...req.body, filename }))
  res.json({
    upload_id: uploadId,
    presigned: { url: `http://localhost:${PORT}/v1/uploads/${uploadId}/content`, method: 'PUT', headers: {} },
  })
})

app.put('/v1/uploads/:id/content', express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
  if (!/^[\w-]+$/.test(req.params.id)) return res.status(400).end()
  const dir = path.join(ARTIFACTS_DIR, req.params.id)
  const meta = JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8').catch(() => '{}'))
  await fs.writeFile(path.join(dir, meta.filename ?? 'upload.bin'), req.body)
  res.status(200).end()
})

app.post('/v1/uploads/:id/finalize', express.json(), async (req, res) => {
  if (!/^[\w-]+$/.test(req.params.id)) return res.status(400).end()
  const meta = JSON.parse(await fs.readFile(path.join(ARTIFACTS_DIR, req.params.id, 'meta.json'), 'utf8').catch(() => '{}'))
  res.json({ artifact_id: req.params.id, message_id: meta.message_id ?? '', status: 'ready' })
})

app.use('/assets', express.static(ASSETS_DIR, { maxAge: '7d' }))

app.get('/health', (_req, res) => res.json({ ok: true }))

await ensureDataDirs()
app.listen(PORT, () => {
  console.log(`Campaign Agent backend listening on http://localhost:${PORT}`)
})
