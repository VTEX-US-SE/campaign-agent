import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Content } from '@google/genai'

import { type CampaignState, emptyCampaignState } from './campaign.js'
import type { TimelineItem } from './protocol.js'

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), 'data'))
const CONVERSATIONS_DIR = path.join(DATA_DIR, 'conversations')
export const ARTIFACTS_DIR = path.join(DATA_DIR, 'artifacts')
export const ASSETS_DIR = path.join(DATA_DIR, 'assets')

export interface Conversation {
  id: string
  account: string
  summary: string
  createdAt: string
  updatedAt: string
  timeline: TimelineItem[]
  history: Content[]
  state: CampaignState
  processedMessageIds: string[]
}

function conversationPath(id: string) {
  if (!/^[\w-]+$/.test(id)) throw new Error(`Invalid conversation id: ${id}`)
  return path.join(CONVERSATIONS_DIR, `${id}.json`)
}

export async function ensureDataDirs() {
  await Promise.all([CONVERSATIONS_DIR, ARTIFACTS_DIR, ASSETS_DIR].map((dir) => fs.mkdir(dir, { recursive: true })))
}

export async function loadConversation(id: string): Promise<Conversation | null> {
  try {
    const raw = await fs.readFile(conversationPath(id), 'utf8')
    return JSON.parse(raw) as Conversation
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function loadOrCreateConversation(id: string, account: string, firstText: string): Promise<Conversation> {
  const existing = await loadConversation(id)
  if (existing) return existing
  const now = new Date().toISOString()
  return {
    id,
    account,
    summary: firstText.slice(0, 80) || 'New campaign',
    createdAt: now,
    updatedAt: now,
    timeline: [],
    history: [],
    state: emptyCampaignState(),
    processedMessageIds: [],
  }
}

export async function saveConversation(conversation: Conversation) {
  conversation.updatedAt = new Date().toISOString()
  const file = conversationPath(conversation.id)
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(conversation, null, 2))
  await fs.rename(tmp, file)
}

export async function listConversations(account: string, limit: number) {
  const files = await fs.readdir(CONVERSATIONS_DIR).catch(() => [] as string[])
  const conversations = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map((file) => loadConversation(file.replace(/\.json$/, '')).catch(() => null)),
  )
  return conversations
    .filter((c): c is Conversation => Boolean(c) && c!.account === account)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map((c) => ({ id: c.id, summary: c.summary, createdAt: c.createdAt, updatedAt: c.updatedAt }))
}
