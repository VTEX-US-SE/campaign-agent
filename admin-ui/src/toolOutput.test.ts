import { describe, expect, it } from 'vitest'

import { getToolOutput } from './toolOutput'

describe('getToolOutput', () => {
  it('returns null for null input', () => {
    expect(getToolOutput(null)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(getToolOutput('string')).toBeNull()
    expect(getToolOutput(42)).toBeNull()
  })

  it('unwraps Strands array format [{ json: <envelope> }]', () => {
    const envelope = {
      status: 'success',
      message: 'Confirmation action requested',
      data: {
        operation_id: 'op_abc123',
        message: 'Delete?',
        action_label: 'Delete',
        confirm_text: 'Yes, proceed',
        details: { title: "Delete 'X'", action_label: 'Delete', tool_name: 'delete_collection', fields: [] },
      },
    }
    const output = [{ json: envelope }]
    const result = getToolOutput<{ action_label: string; details: { title: string } }>(output)
    expect(result?.status).toBe('success')
    expect(result?.data?.action_label).toBe('Delete')
    expect(result?.data?.details?.title).toBe("Delete 'X'")
  })

  it('returns null for array without json block', () => {
    expect(getToolOutput([{ text: 'no json here' }])).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(getToolOutput([])).toBeNull()
  })

  it('returns envelope as-is when it already has status+message+data (test/mock format)', () => {
    const envelope = {
      status: 'success',
      message: 'OK',
      data: { message: 'Do it?', action_label: 'Do', confirm_text: 'yes' },
    }
    const result = getToolOutput(envelope)
    expect(result).toEqual(envelope)
  })

  it('wraps non-envelope object in fallback', () => {
    const raw = { name: 'Summer', Id: 1 }
    const result = getToolOutput(raw)
    expect(result?.status).toBe('success')
    expect(result?.data).toEqual(raw)
  })
})
