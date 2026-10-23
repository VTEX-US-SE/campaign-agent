import type { Response } from 'express'

/**
 * VTEX UI protocol envelopes consumed by @vtex/agentic-ui (`mapEnvelopeToMessage`).
 *
 * Every event of one assistant turn must share the same `messageId`: the UI
 * groups text and tool cards by it. Tool events must carry `status: 'success'`
 * or the UI drops them; failures travel inside the `{ status, message, data }`
 * output envelope instead.
 */

export type EnvelopeType = 'ui.message' | 'ui.delta' | 'ui.final'

export interface EnvelopeBase {
  messageId: string
  parentMessageId: string
  conversationId: string
}

export interface Envelope {
  type: EnvelopeType
  payload: {
    kind: 'text.final' | 'text.delta' | 'tool' | 'reasoning.step'
    role: 'assistant'
    messageId: string
    parentMessageId: string
    conversationId: string
    createdAt: string
    content: Record<string, unknown>
    metadata?: Record<string, unknown>
  }
}

export interface ToolEnvelopeOutput<T = unknown> {
  status: 'success' | 'error'
  message: string
  data: T | null
  code?: string | number
}

/** Opens the assistant row so the chat can show the thinking dots before any text or tool arrives. */
export function reasoningEnvelope(base: EnvelopeBase, status: 'start' | 'end' = 'start'): Envelope {
  return {
    type: 'ui.message',
    payload: {
      kind: 'reasoning.step',
      role: 'assistant',
      ...base,
      createdAt: new Date().toISOString(),
      content: { status },
    },
  }
}

export function textEnvelope(base: EnvelopeBase, text: string, type: EnvelopeType = 'ui.message'): Envelope {
  return {
    type,
    payload: {
      kind: 'text.final',
      role: 'assistant',
      ...base,
      createdAt: new Date().toISOString(),
      content: { text, mimeType: 'text/markdown' },
    },
  }
}

export function toolEnvelope(
  base: EnvelopeBase,
  name: string,
  args: Record<string, unknown>,
  output: ToolEnvelopeOutput,
): Envelope {
  return {
    type: 'ui.message',
    payload: {
      kind: 'tool',
      role: 'assistant',
      ...base,
      createdAt: new Date().toISOString(),
      content: { name, args, status: 'success', output },
    },
  }
}

/** Timeline item shape replayed by `ingestTasks` / `mapTaskToMessage`. */
export interface TimelineItem {
  event: 'message'
  type: 'text' | 'tool'
  messageId: string
  parentMessageId: string
  createdAt: string
  role: 'user' | 'assistant'
  data: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export function envelopeToTimelineItem(env: Envelope): TimelineItem | null {
  const { payload } = env
  if (payload.kind === 'tool') {
    return {
      event: 'message',
      type: 'tool',
      messageId: payload.messageId,
      parentMessageId: payload.parentMessageId,
      createdAt: payload.createdAt,
      role: 'assistant',
      data: payload.content,
    }
  }
  if (payload.kind === 'text.final') {
    const text = String(payload.content.text ?? '')
    if (!text) return null
    return {
      event: 'message',
      type: 'text',
      messageId: payload.messageId,
      parentMessageId: payload.parentMessageId,
      createdAt: payload.createdAt,
      role: 'assistant',
      data: { text: { value: text }, mimeType: payload.content.mimeType },
    }
  }
  return null
}

export class SseWriter {
  private closed = false

  constructor(private res: Response) {
    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()
    res.on('close', () => {
      this.closed = true
    })
  }

  get isClosed() {
    return this.closed
  }

  send(env: Envelope) {
    if (this.closed) return
    this.res.write(`event: ${env.type}\ndata: ${JSON.stringify(env)}\n\n`)
  }

  comment(text: string) {
    if (this.closed) return
    this.res.write(`: ${text}\n\n`)
  }

  end() {
    if (this.closed) return
    this.closed = true
    this.res.end()
  }
}
