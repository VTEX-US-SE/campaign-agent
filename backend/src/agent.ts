import type { Content, Part } from '@google/genai'

import { getGemini, textModel } from './clients/gemini.js'
import type { RequestContext } from './context.js'
import { systemPrompt } from './prompts/system.js'
import {
  type Envelope,
  type EnvelopeBase,
  envelopeToTimelineItem,
  type SseWriter,
  reasoningEnvelope,
  textEnvelope,
  type ToolEnvelopeOutput,
  toolEnvelope,
} from './protocol.js'
import type { Conversation } from './store.js'
import { functionDeclarations, toolsByName } from './tools/index.js'
import { failure } from './tools/types.js'

const MAX_STEPS = 16

export interface TurnInput {
  ctx: RequestContext
  conversation: Conversation
  userText: string
  writer: SseWriter
}

/** Marks the plan as confirmed when the user's message carries the pending confirmation code. */
export function applyConfirmation(conversation: Conversation, userText: string): boolean {
  const pending = conversation.state.pendingConfirmation
  if (!pending || !userText.toUpperCase().includes(pending.token)) return false
  conversation.state.confirmedPlan = pending.plan
  conversation.state.pendingConfirmation = undefined
  return true
}

async function runTool(name: string, args: Record<string, unknown>, input: TurnInput): Promise<ToolEnvelopeOutput> {
  const tool = toolsByName.get(name)
  if (!tool) return failure(`Unknown tool ${name}`, 'UNKNOWN_TOOL')
  try {
    return await tool.handler(args, { ctx: input.ctx, conversation: input.conversation })
  } catch (error) {
    console.error(`[tool:${name}]`, error)
    return failure((error as Error).message || 'Unexpected error', (error as { status?: number }).status)
  }
}

export async function runTurn(input: TurnInput) {
  const { ctx, conversation, writer } = input
  const base: EnvelopeBase = {
    messageId: ctx.messageId,
    parentMessageId: ctx.messageId,
    conversationId: ctx.conversationId,
  }

  const emit = (env: Envelope) => {
    writer.send(env)
    const item = envelopeToTimelineItem(env)
    if (item) conversation.timeline.push(item)
  }

  const confirmed = applyConfirmation(conversation, input.userText)
  const userParts: Part[] = [{ text: input.userText }]
  if (confirmed) {
    userParts.push({ text: '[System note: the user confirmed the campaign plan. Run the creation steps now.]' })
  }
  conversation.history.push({ role: 'user', parts: userParts })

  const today = new Date().toISOString().slice(0, 10)
  const keepAlive = setInterval(() => writer.comment('keep-alive'), 15000)
  // The thinking dots only render on an assistant message. Send one before the model call,
  // which is the long silent gap after the first message.
  emit(reasoningEnvelope(base, 'start'))

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      if (writer.isClosed) break
      const response = await getGemini().models.generateContent({
        model: textModel(),
        contents: conversation.history,
        config: {
          systemInstruction: systemPrompt(today, ctx.locale),
          tools: [{ functionDeclarations: functionDeclarations() }],
          temperature: 0.4,
        },
      })

      const content: Content | undefined = response.candidates?.[0]?.content
      if (!content?.parts?.length) {
        emit(textEnvelope(base, 'I could not produce an answer. Please try rephrasing your request.'))
        break
      }
      conversation.history.push({ role: 'model', parts: content.parts })

      const text = content.parts
        .filter((part) => part.text && !part.thought)
        .map((part) => part.text)
        .join('')
        .trim()
      if (text) emit(textEnvelope(base, `${text}\n\n`))

      const calls = content.parts.filter((part) => part.functionCall).map((part) => part.functionCall!)
      if (calls.length === 0) break

      const responses: Part[] = []
      let terminal = false
      for (const call of calls) {
        const name = call.name ?? 'unknown'
        const args = (call.args ?? {}) as Record<string, unknown>
        const output = await runTool(name, args, input)
        emit(toolEnvelope(base, name, args, output))
        const found = (output.data as { total?: number } | null)?.total ?? 0
        const outputForModel =
          name === 'search_products' && output.status === 'success' && found > 0
            ? {
                ...output,
                next: 'These products are the catalog matches. Do not call search_products again unless none of them fit the request. Otherwise call preview_collection_products with the matching product IDs.',
              }
            : output
        responses.push({ functionResponse: { id: call.id, name, response: { output: outputForModel } } })
        if (toolsByName.get(name)?.terminal && output.status === 'success') terminal = true
      }
      conversation.history.push({ role: 'user', parts: responses })
      if (terminal) break
    }
  } catch (error) {
    console.error('[agent]', error)
    emit(textEnvelope(base, `Something went wrong while talking to Gemini: ${(error as Error).message}`))
  } finally {
    clearInterval(keepAlive)
  }

  writer.send(textEnvelope(base, '', 'ui.final'))
}
