import { describe, expect, it } from 'vitest'

import { envelopeToTimelineItem, reasoningEnvelope, textEnvelope, toolEnvelope } from '../src/protocol.js'

const base = { messageId: 'm1', parentMessageId: 'm1', conversationId: 'c1' }

describe('protocol envelopes', () => {
  it('builds text.final envelopes that agentic-ui maps to text messages', () => {
    const env = textEnvelope(base, 'Hello')
    expect(env.type).toBe('ui.message')
    expect(env.payload).toMatchObject({
      kind: 'text.final',
      role: 'assistant',
      messageId: 'm1',
      conversationId: 'c1',
      content: { text: 'Hello' },
    })
  })

  it('always marks tool events as success so the UI renders them, carrying errors in the output envelope', () => {
    const env = toolEnvelope(base, 'create_collection', {}, { status: 'error', message: 'boom', data: null })
    expect(env.payload.kind).toBe('tool')
    expect(env.payload.content).toMatchObject({
      name: 'create_collection',
      status: 'success',
      output: { status: 'error', message: 'boom' },
    })
  })

  it('converts envelopes to replayable timeline items', () => {
    expect(envelopeToTimelineItem(textEnvelope(base, 'Hi'))).toMatchObject({
      event: 'message',
      type: 'text',
      role: 'assistant',
      messageId: 'm1',
      data: { text: { value: 'Hi' } },
    })
    expect(envelopeToTimelineItem(toolEnvelope(base, 'search_products', { query: 'x' }, { status: 'success', message: '', data: {} })))
      .toMatchObject({ type: 'tool', data: { name: 'search_products', args: { query: 'x' }, status: 'success' } })
  })

  it('starts a reasoning step so the chat can show the thinking animation', () => {
    const env = reasoningEnvelope(base)
    expect(env.payload).toMatchObject({ kind: 'reasoning.step', role: 'assistant', content: { status: 'start' } })
    expect(envelopeToTimelineItem(env)).toBeNull()
  })

  it('skips empty final markers in the timeline', () => {
    expect(envelopeToTimelineItem(textEnvelope(base, '', 'ui.final'))).toBeNull()
  })
})
