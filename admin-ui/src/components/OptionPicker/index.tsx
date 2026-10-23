import { ToolComponentProps, useChatContext } from '@vtex/agentic-ui'
import { Alert, Button, Flex, Text } from '@vtex/shoreline'
import { useState } from 'react'

import { getToolOutput } from '../../toolOutput'
import { ToolErrorInfoCard } from '../ToolErrorInfoCard'

interface Option {
  label: string
  value: string
}

interface OptionPickerData {
  message: string
  options: Option[]
}

export function OptionPicker(props: ToolComponentProps) {
  const output = getToolOutput<OptionPickerData>(props.data.output)
  const { sendMessage } = useChatContext()
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (output?.status === 'error') {
    return <ToolErrorInfoCard title="Option selection failed" output={output} />
  }

  const data = output?.data
  if (!data) return null

  const selectOption = async (option: Option) => {
    setSelectedValue(option.value)
    setSubmitError(null)

    try {
      await sendMessage(
        { inputs: [{ type: 'text', text: option.label }] },
        { metadata: { option_picker: { value: option.value } } },
      )
    } catch {
      setSubmitError('Could not send your selection. Please try again.')
    } finally {
      setSelectedValue(null)
    }
  }

  return (
    <Flex direction="column" gap="var(--sl-space-3)" style={{ padding: 'var(--sl-space-3) 0' }}>
      <Text variant="body">{data.message}</Text>
      {submitError ? (
        <Alert variant="critical">
          <Text variant="body">{submitError}</Text>
        </Alert>
      ) : null}
      <Flex direction="column" gap="var(--sl-space-2)">
        {data.options.map((option) => (
          <Button
            key={option.value}
            variant="secondary"
            onClick={() => selectOption(option)}
            loading={selectedValue === option.value}
            disabled={selectedValue !== null}
            className="option-picker-button"
          >
            {option.label}
          </Button>
        ))}
      </Flex>
    </Flex>
  )
}
