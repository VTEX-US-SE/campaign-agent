import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const sendMessage = vi.fn()

afterEach(() => {
  cleanup()
  sendMessage.mockReset()
})

vi.mock('@vtex/agentic-ui', () => ({
  useChatContext: () => ({ sendMessage }),
}))

vi.mock('@vtex/shoreline', () => {
  const Wrap = ({ children }: { children: ReactNode }) => <div>{children}</div>

  return {
    Alert: Wrap,
    Button: ({ children, ...props }: { children: ReactNode }) => <button {...props}>{children}</button>,
    Flex: Wrap,
    Text: Wrap,
  }
})

vi.mock('../ToolErrorInfoCard', () => ({
  ToolErrorInfoCard: ({ title }: { title: string }) => <div>{title}</div>,
}))

import { OptionPicker } from './index'

const options = [
  { label: 'Summer Sale', value: 'Use collection ID 142' },
  { label: 'Winter Sale', value: 'Use collection ID 143' },
]

function makeProps(output: unknown) {
  return { data: { output } } as any
}

function successOutput() {
  return {
    status: 'success',
    message: 'Option selection requested',
    data: { message: 'Which collection do you mean?', options },
  }
}

describe('OptionPicker', () => {
  it('renders message and option labels', () => {
    render(<OptionPicker {...makeProps(successOutput())} />)

    expect(screen.getByText('Which collection do you mean?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Summer Sale' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Winter Sale' })).toBeTruthy()
  })

  it('sends selected option label and value metadata', async () => {
    sendMessage.mockResolvedValue(undefined)
    render(<OptionPicker {...makeProps(successOutput())} />)

    fireEvent.click(screen.getByRole('button', { name: 'Summer Sale' }))

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        { inputs: [{ type: 'text', text: 'Summer Sale' }] },
        { metadata: { option_picker: { value: 'Use collection ID 142' } } },
      )
    })
  })

  it('disables all options while selection is pending', () => {
    let resolveSend: () => void
    sendMessage.mockReturnValue(new Promise<void>((resolve) => (resolveSend = resolve)))
    render(<OptionPicker {...makeProps(successOutput())} />)

    fireEvent.click(screen.getByRole('button', { name: 'Summer Sale' }))

    expect(screen.getByRole('button', { name: 'Summer Sale' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Winter Sale' })).toHaveProperty('disabled', true)
    resolveSend!()
  })

  it('shows error and allows retry after send failure', async () => {
    sendMessage.mockRejectedValueOnce(new Error('network error'))
    render(<OptionPicker {...makeProps(successOutput())} />)

    fireEvent.click(screen.getByRole('button', { name: 'Summer Sale' }))

    await waitFor(() => {
      expect(screen.getByText('Could not send your selection. Please try again.')).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: 'Summer Sale' })).toHaveProperty('disabled', false)
  })

  it('renders tool error information', () => {
    render(
      <OptionPicker
        {...makeProps({ status: 'error', message: 'Invalid choices', data: null })}
      />
    )

    expect(screen.getByText('Option selection failed')).toBeTruthy()
  })
})
