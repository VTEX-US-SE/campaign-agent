import { describe, expect, it } from 'vitest'

import { parseAttachmentMarkers } from './marker'

describe('parseAttachmentMarkers', () => {
  it('returns the original text unchanged when there is no marker', () => {
    const text = 'Add these to collection 333.'
    expect(parseAttachmentMarkers(text)).toEqual({
      strippedText: text,
      attachments: [],
    })
  })

  it('parses a single marker appended after user text', () => {
    const text =
      'Add these to collection 333.\n\n' +
      '[Attached file: products.csv (mime: text/csv, ' +
      'uri: vtex-artifact://019ead0e-ff23-7633-b41e-42b932852bff)]'

    expect(parseAttachmentMarkers(text)).toEqual({
      strippedText: 'Add these to collection 333.',
      attachments: [
        {
          artifactId: '019ead0e-ff23-7633-b41e-42b932852bff',
          uri: 'vtex-artifact://019ead0e-ff23-7633-b41e-42b932852bff',
          name: 'products.csv',
          mimeType: 'text/csv',
        },
      ],
    })
  })

  it('parses the optional size segment into a number', () => {
    const text =
      'Add these to collection 333.\n\n' +
      '[Attached file: products.csv (mime: text/csv, size: 2048, ' +
      'uri: vtex-artifact://019ead0e-ff23-7633-b41e-42b932852bff)]'

    expect(parseAttachmentMarkers(text)).toEqual({
      strippedText: 'Add these to collection 333.',
      attachments: [
        {
          artifactId: '019ead0e-ff23-7633-b41e-42b932852bff',
          uri: 'vtex-artifact://019ead0e-ff23-7633-b41e-42b932852bff',
          name: 'products.csv',
          mimeType: 'text/csv',
          size: 2048,
        },
      ],
    })
  })

  it('parses a legacy marker without size (size is undefined)', () => {
    const text =
      '[Attached file: a.csv (mime: text/csv, uri: vtex-artifact://aa)]'

    const { attachments } = parseAttachmentMarkers(text)
    expect(attachments).toHaveLength(1)
    expect(attachments[0].artifactId).toBe('aa')
    expect(attachments[0].size).toBeUndefined()
  })

  it('returns an empty stripped text when the marker is the only content', () => {
    const text =
      '[Attached file: products.xlsx (mime: ' +
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, ' +
      'uri: vtex-artifact://abc-123)]'

    const { strippedText, attachments } = parseAttachmentMarkers(text)
    expect(strippedText).toBe('')
    expect(attachments).toHaveLength(1)
    expect(attachments[0]).toEqual({
      artifactId: 'abc-123',
      uri: 'vtex-artifact://abc-123',
      name: 'products.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  })

  it('parses multiple markers and dedupes by artifact id', () => {
    const text =
      'Use both files:\n\n' +
      '[Attached file: a.csv (mime: text/csv, uri: vtex-artifact://aa)]\n' +
      '[Attached file: b.csv (mime: text/csv, uri: vtex-artifact://bb)]\n' +
      // duplicate of the first one
      '[Attached file: a.csv (mime: text/csv, uri: vtex-artifact://aa)]'

    const result = parseAttachmentMarkers(text)
    expect(result.attachments.map((a) => a.artifactId)).toEqual(['aa', 'bb'])
    expect(result.strippedText).toBe('Use both files:')
  })

  it('preserves text in between markers', () => {
    const text =
      'First file:\n' +
      '[Attached file: a.csv (mime: text/csv, uri: vtex-artifact://aa)]\n' +
      'Then this one:\n' +
      '[Attached file: b.csv (mime: text/csv, uri: vtex-artifact://bb)]\n' +
      'Done.'

    const result = parseAttachmentMarkers(text)
    expect(result.strippedText).toContain('First file:')
    expect(result.strippedText).toContain('Then this one:')
    expect(result.strippedText).toContain('Done.')
    expect(result.strippedText).not.toContain('[Attached file:')
    expect(result.attachments).toHaveLength(2)
  })

  it('ignores malformed markers (missing fields)', () => {
    const text = '[Attached file: products.csv (mime: text/csv)]'
    expect(parseAttachmentMarkers(text)).toEqual({
      strippedText: text,
      attachments: [],
    })
  })

  it('ignores non-vtex-artifact URIs', () => {
    const text =
      '[Attached file: x.csv (mime: text/csv, uri: https://example.com/x.csv)]'
    expect(parseAttachmentMarkers(text)).toEqual({
      strippedText: text,
      attachments: [],
    })
  })

  it('handles non-string input defensively', () => {
    expect(parseAttachmentMarkers(undefined)).toEqual({
      strippedText: '',
      attachments: [],
    })
    expect(parseAttachmentMarkers(null)).toEqual({
      strippedText: '',
      attachments: [],
    })
    expect(parseAttachmentMarkers(42)).toEqual({
      strippedText: '',
      attachments: [],
    })
  })
})
