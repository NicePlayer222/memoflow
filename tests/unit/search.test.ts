import { describe, expect, it } from 'vitest'
import { buildIndex, highlightPattern, searchItems } from '../../src/search'
import type { InboxItem } from '../../src/types/inbox'

function item(id: string, title: string, rawContent = ''): InboxItem {
  return {
    id, source: 'manual', title, rawContent, createdAt: '', importedAt: '', status: 'pending', fingerprint: id,
  }
}

describe('local inbox search', () => {
  it('finds CJK bigrams inside unsegmented text and supports single-character queries', () => {
    const index = buildIndex([item('a', '这是一段城市漫步笔记'), item('b', '城市和长途徒步')])
    expect(searchItems(index, '市漫步')).toEqual(['a'])
    expect(searchItems(index, '记')).toEqual(['a'])
    expect(searchItems(index, '市漫记')).toEqual([])
  })

  it('separates adjacent Latin and CJK runs and supports case-insensitive Latin prefixes', () => {
    const index = buildIndex([item('a', 'React组件练习', 'IndexedDB and Dexie'), item('b', 'React Notes')])
    expect(searchItems(index, 'REAC组件')).toEqual(['a'])
    expect(searchItems(index, '组件 INDEX')).toEqual(['a'])
    expect(searchItems(index, 'Ｄｅｘｉｅ')).toEqual(['a'])
  })

  it('searches summary, tags and bilingual keywords of processed entries', () => {
    const ready = item('a', '阅读卡片')
    ready.ai = {
      summary: '记录一次现场采访', tags: ['播客', '声音'], searchKeywords: ['声音采集', 'field recording', '采访'],
      category: '艺术与文化', takeaways: ['保留环境声'], processedAt: '', model: 'mock-local',
    }
    const index = buildIndex([ready, item('b', '尚未处理')])
    for (const query of ['现场采访', '播客', '声音采集', 'field recording']) {
      expect(searchItems(index, query)).toEqual(['a'])
    }
    expect(searchItems(index, ' ')).toEqual([])
  })

  it('ranks title matches ahead of equally frequent body matches', () => {
    const index = buildIndex([item('body', 'Notes', 'React'), item('title', 'React', 'Notes')])
    expect(searchItems(index, 'react')).toEqual(['title', 'body'])
  })

  it('highlights whole Chinese phrases, Latin prefixes and matching individual bigrams', () => {
    const pattern = highlightPattern('声音采集 FIELD')
    expect('随手记录声音采集和 field notes'.split(pattern!)).toEqual(['随手记录', '声音采集', '和 ', 'field', ' notes'])
    expect('先采集音频'.match(pattern!)?.[0]).toBe('采集')
    expect(highlightPattern('<.*>')).toBeUndefined()
  })
})
