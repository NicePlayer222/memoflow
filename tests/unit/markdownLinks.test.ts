import { describe, expect, it } from 'vitest'
import fixture from '../fixtures/dirty-links.md?raw'
import { parseMarkdownLinks } from '../../src/parsers/markdownLinks'

describe('parseMarkdownLinks', () => {
  it('extracts inline, bare, reference and angle-bracket links in source order', () => {
    const drafts = parseMarkdownLinks(fixture)
    expect(drafts.map(draft => draft.url)).toEqual([
      'https://en.wikipedia.org/wiki/Consensus_(computer_science)',
      'https://docs.example.org/guide_(v2)',
      'https://example.org/入门',
      'https://dexie.org/docs/Tutorial/Getting-started',
      'https://example.org/tools?lang=en&ref=notes',
      'https://example.org/a',
      'https://example.org/b',
    ])
    expect(drafts[0]).toMatchObject({ source: 'markdown', title: '分布式系统' })
    expect(drafts[0]?.rawContent).toContain('重点关注 quorum')
    expect(drafts[3]?.title).toBe('Dexie 指南')
    expect(drafts.at(-1)?.rawContent).toBe('复查：https://example.org/b')
  })

  it('leaves repeated occurrences for database deduplication and emits each occurrence once', () => {
    const drafts = parseMarkdownLinks('[First](https://example.org/a) and https://example.org/a.')
    expect(drafts.map(draft => draft.title)).toEqual(['First', 'https://example.org/a'])
  })

  it('recognizes links inside emphasis and table cells', () => {
    const drafts = parseMarkdownLinks('| 资源 |\n| --- |\n| **[指南](https://example.org/guide)** |')
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.title).toBe('指南')
  })

  it('ignores blank notes, malformed hosts, and non-web destinations', () => {
    expect(parseMarkdownLinks('   ')).toEqual([])
    expect(parseMarkdownLinks('[broken](https://) [unsafe](javascript:void(0)) Plain text')).toEqual([])
  })
})
