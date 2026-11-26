import { strFromU8, unzipSync } from 'fflate'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'
import { exportMarkdown, exportObsidianZip } from '../../src/export/markdown'
import type { InboxItem } from '../../src/types/inbox'

function item(title: string, extra: Partial<InboxItem> = {}): InboxItem {
  return {
    id: 'id-' + title, title, source: 'manual', status: 'pending',
    rawContent: '下次访谈前复查。\nInterview notes in English.',
    createdAt: '2026-11-26T06:00:00.000Z', importedAt: '2026-11-26T07:00:00.000Z',
    fingerprint: 'fingerprint-' + title, ...extra,
  }
}

const analysis = {
  category: '研究', tags: ['访谈', 'reading: #1'], summary: '阅读前准备访谈大纲。',
  takeaways: ['先准备开放式问题。'], searchKeywords: ['访谈', 'interview'],
  processedAt: '2026-11-26T07:01:00.000Z', model: 'mock-local',
}

describe('Markdown export', () => {
  it('preserves order, original notes, bookmark context and AI text in the aggregate', () => {
    const markdown = exportMarkdown([
      item('第一篇', { author: 'Lin', folderPath: ['研究', '访谈'], url: 'https://example.org/read', ai: analysis }),
      item('Second'),
    ])
    expect(markdown).toContain('## 第一篇')
    expect(markdown.indexOf('## Second')).toBeGreaterThan(markdown.indexOf('## 第一篇'))
    for (const value of ['下次访谈前复查。', 'Interview notes in English.', 'Lin', '研究 / 访谈',
      'https://example.org/read', analysis.summary, ...analysis.takeaways, ...analysis.tags, ...analysis.searchKeywords]) {
      expect(markdown).toContain(value)
    }
  })

  it('round-trips the YAML fields with quotes, punctuation, Unicode and control characters', () => {
    const row = item('标题 "quotes" : # comment\n---\nnew: yes\u0001\u0085\u2028', {
      url: 'https://example.org/path?x=2&y=1#hash', ai: analysis,
    })
    const files = Object.values(unzipSync(exportObsidianZip([row])))
    expect(files).toHaveLength(1)
    const note = strFromU8(files[0]!)
    const match = /^---\n([\s\S]*?)\n---\n\n/.exec(note)
    expect(match).not.toBeNull()
    expect(parse(match![1]!)).toEqual({
      title: row.title, source: row.source, url: row.url, created: row.createdAt,
      category: analysis.category, tags: analysis.tags,
    })
    const body = note.slice(match![0].length)
    expect(body).toContain('Interview notes in English.')
    expect(body).toContain(analysis.summary)
  })

  it('writes a unique portable file for every row even when titles collide after sanitizing', () => {
    const titles = ['访谈', '访谈', '访谈 (2)', 'README', 'readme', '..\\escape/../../note', 'CON', 'con.txt', 'LPT¹',
      'A:B', 'A/B', '.', ' ', '👁'.repeat(200), '👁'.repeat(201), 'Résumé', 'Re\u0301sume\u0301']
    const names = Object.keys(unzipSync(exportObsidianZip(titles.map(title => item(title)))))
    expect(names).toContain('访谈.md')
    expect(new Set(names.map(name => name.normalize('NFKC').toLowerCase())).size).toBe(titles.length)
    for (const name of names) {
      expect(name).toMatch(/\.md$/)
      expect(name).not.toMatch(/^[. ]|[<>:"/\\|?*\p{Cc}]|[. ]\.md$/u)
      expect(name).not.toMatch(/^(?:con|lpt1)\./i)
      expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(255)
    }
  })

  it('exports an unprocessed note without invented AI fields', () => {
    const files = unzipSync(exportObsidianZip([item('草稿')]))
    const note = strFromU8(files['草稿.md']!)
    const metadata = parse(note.split('\n---\n')[0]!.slice(4))
    expect(metadata).toMatchObject({ title: '草稿', url: null, category: null, tags: [] })
    expect(note).not.toContain('AI 整理')
  })

  it('produces a readable empty document and an empty valid zip', () => {
    expect(exportMarkdown([]).trim()).toBe('# MemoFlow 收件箱')
    expect(unzipSync(exportObsidianZip([]))).toEqual({})
  })
})
