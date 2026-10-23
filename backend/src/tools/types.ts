import type { RequestContext } from '../context.js'
import type { ToolEnvelopeOutput } from '../protocol.js'
import type { Conversation } from '../store.js'

export interface ToolContext {
  ctx: RequestContext
  conversation: Conversation
}

export interface AgentTool<TArgs = Record<string, unknown>> {
  name: string
  description: string
  parameters: Record<string, unknown>
  /** Ends the assistant turn after it runs, so the user can answer (pickers, confirmations). */
  terminal?: boolean
  handler: (args: TArgs, toolCtx: ToolContext) => Promise<ToolEnvelopeOutput>
}

export function success<T>(message: string, data: T): ToolEnvelopeOutput<T> {
  return { status: 'success', message, data }
}

export function failure(message: string, code?: string | number): ToolEnvelopeOutput<null> {
  return { status: 'error', message, data: null, code }
}
