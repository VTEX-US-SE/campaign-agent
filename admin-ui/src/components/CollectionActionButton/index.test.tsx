import { cleanup, render, screen } from '@testing-library/react'
import type { CSSProperties, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

vi.mock('@vtex/agentic-ui', () => ({
  useChatContext: () => ({ sendMessage: vi.fn() }),
}))

vi.mock('@vtex/shoreline', () => {
  const Wrap = ({ children }: { children: ReactNode }) => <div>{children}</div>

  return {
    Alert: Wrap,
    Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
    Flex: Wrap,
    Heading: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
    Tag: ({ children, title }: { children: ReactNode; title?: string }) => (
      <span title={title}>{children}</span>
    ),
    Text: ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
      <span style={style}>{children}</span>
    ),
  }
})

import { CollectionActionButton } from './index'

/**
 * Build a full ``ToolComponentProps.data.output`` envelope with the shape
 * ``getToolOutput`` expects to unwrap directly (top-level ``status``,
 * ``message``, and ``data`` fields). Passing just ``{status, data}`` triggers
 * the "not-an-envelope" fallback in ``getToolOutput`` which double-wraps the
 * payload and hides the fields the component destructures.
 */
function makeEnvelope(inner: {
  message: string
  action_label: string
  confirm_text: string
  details?: any
}) {
  return {
    data: {
      output: {
        status: 'success',
        message: inner.message,
        data: inner,
      },
    },
  } as any
}

describe('CollectionActionButton', () => {
  it('renders the confirmation message and action label', () => {
    render(
      <CollectionActionButton
        {...makeEnvelope({
          message: "Create collection 'Winter'?",
          action_label: 'Create',
          confirm_text: 'Yes, create it',
        })}
      />
    )

    expect(screen.getByText("Create collection 'Winter'?")).toBeTruthy()
    expect(screen.getByText('Create')).toBeTruthy()
  })

  it('preserves newlines in the summary so per-rule breakdowns render on separate lines', () => {
    // create_collection now emits a multi-line summary that lists each rule
    // (see backend `_build_confirmation_summary`). Without whiteSpace pre-wrap
    // the browser would collapse the newlines and the breakdown would be
    // illegible.
    const multiLine =
      "Create collection 'Bundle' with 2 rule(s)?\n" +
      'Rule 1: inclusive rule (3 brands)\n' +
      'Rule 2: exclusive rule (1 categories)'

    render(
      <CollectionActionButton
        {...makeEnvelope({
          message: multiLine,
          action_label: 'Create the collection',
          confirm_text: 'Confirm',
        })}
      />
    )

    // Testing-library's default text normalizer collapses whitespace;
    // disable it so newlines participate in the exact-match comparison.
    const summary = screen.getByText(multiLine, {
      normalizer: (text) => text,
    })
    expect(summary).toBeTruthy()
    // Verify the CSS survived so the rendered element actually preserves the
    // newlines visually in a real browser.
    expect((summary as HTMLElement).style.whiteSpace).toBe('pre-wrap')
  })

  it('shows the action label on the button verbatim', () => {
    render(
      <CollectionActionButton
        {...makeEnvelope({
          message: 'Confirm this?',
          action_label: 'Do it',
          confirm_text: 'yes',
        })}
      />
    )
    expect(screen.getByText('Do it')).toBeTruthy()
  })

  // ---------------------------------------------------------------------------
  // details present / absent branching (task 8.3)
  // ---------------------------------------------------------------------------

  it('renders OperationDetails title when details is present and hides plain message', () => {
    const details = {
      title: "Delete collection 'X' (id 5)",
      action_label: 'Delete',
      tool_name: 'delete_collection',
      fields: [{ label: 'Id', value: 5, kind: 'text' }],
    }
    render(
      <CollectionActionButton
        {...makeEnvelope({
          message: 'This plain message should not be visible',
          action_label: 'Delete',
          confirm_text: 'Yes, proceed with the operation',
          details,
        })}
      />
    )

    // Structured title must be present
    expect(screen.getByText("Delete collection 'X' (id 5)")).toBeTruthy()

    // Plain message fallback must NOT be present
    expect(screen.queryByText('This plain message should not be visible')).toBeNull()
  })

  it('renders plain message fallback when details is absent', () => {
    render(
      <CollectionActionButton
        {...makeEnvelope({
          message: 'Do the thing?',
          action_label: 'Do it',
          confirm_text: 'Yes',
          // no details key
        })}
      />
    )

    // Plain message must be present
    expect(screen.getByText('Do the thing?')).toBeTruthy()

    // No OperationDetails title rendered
    expect(screen.queryByText("Delete collection 'X'")).toBeNull()

    // Button still present
    expect(screen.getByText('Do it')).toBeTruthy()
  })
})
