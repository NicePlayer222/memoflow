// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import dirtyBookmarks from '../fixtures/browser-bookmarks.html?raw'
import { parseBrowserHtml } from '../../src/parsers/browserHtml'

describe('parseBrowserHtml', () => {
  it('retains nested folders and returns to the parent and root in export order', () => {
    const items = parseBrowserHtml(dirtyBookmarks)
    expect(items.map(item => [item.title, item.folderPath])).toEqual([
      ['Notes & ideas', ['知识库']],
      ['中文排版', ['知识库', 'Design']],
      ['https://example.org/untitled', ['知识库']],
      ['Root bookmark', []],
    ])
  })

  it('decodes entities and notes, preserves the original URL, and reads valid Unix dates', () => {
    const [first, second, third] = parseBrowserHtml(dirtyBookmarks)
    expect(first).toMatchObject({
      source: 'browser',
      url: 'https://Example.org/notes/?utm_source=reader&lang=zh',
      rawContent: 'Notes & ideas\n有关本地优先软件的讨论。',
      createdAt: '2024-01-01T00:00:00.000Z',
    })
    expect(second).not.toHaveProperty('createdAt')
    expect(third).not.toHaveProperty('createdAt')
  })

  it('ignores unsupported links, missing URLs, and unrelated HTML', () => {
    const dirty = '<a href="https://example.com">page navigation</a><dl><dt><a href="file:///tmp">file</a><dt><a href="/local">relative</a></dl>'
    expect(parseBrowserHtml(dirty)).toEqual([])
    expect(parseBrowserHtml('')).toEqual([])
  })
})
