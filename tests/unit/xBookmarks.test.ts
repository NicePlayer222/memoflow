import { describe, expect, it } from 'vitest'
import { parseXBookmarks } from '../../src/parsers/xBookmarks'
import nestedBookmarks from '../fixtures/x-bookmarks-dirty.json?raw'

describe('parseXBookmarks', () => {
  it('reads nested tweets and long notes without importing cursor, quote or tombstone entries', () => {
    expect(parseXBookmarks(nestedBookmarks)).toEqual([{
      source: 'x',
      title: '长文全文：离线收藏与同步',
      rawContent: '长文全文：离线收藏与同步\nNotes from a train ride.',
      author: 'lin_notes',
      url: 'https://x.com/lin_notes/status/1860123456789000001',
      createdAt: '2024-11-19T09:40:00.000Z',
    }])
  })

  it('reads flat rows, preserves explicit titles and ignores malformed rows', () => {
    const [tweet, textOnly, ...extra] = parseXBookmarks(JSON.stringify({
      bookmarks: [
        null, 17, { text: ' ' }, { url: 'javascript:alert(1)' },
        { text: ' Full text ', title: ' Reading list ', url: 'https://x.com/lee/status/2?s=20',
          author: 'Lee', createdAt: 'not a date' },
        { full_text: 'Saved without a link', id: 9007199254740992, url: 'broken' },
      ],
    }))
    expect(tweet).toMatchObject({
      source: 'x', title: 'Reading list', rawContent: 'Full text', author: 'Lee',
      url: 'https://x.com/lee/status/2?s=20', createdAt: undefined,
    })
    expect(textOnly).toMatchObject({ rawContent: 'Saved without a link', url: undefined })
    expect(extra).toEqual([])
  })

  it('accepts bookmark exports containing only a tweet ID and preserves all digits', () => {
    const [item] = parseXBookmarks('\uFEFF[{"bookmark":{"tweetId":"1860123456789123456"}}]')
    expect(item).toMatchObject({ rawContent: '', url: 'https://x.com/i/web/status/1860123456789123456' })
  })

  it('supports the bookmark_timeline envelope used by older exports', () => {
    expect(parseXBookmarks(nestedBookmarks.replace('bookmark_timeline_v2', 'bookmark_timeline')))
      .toEqual(parseXBookmarks(nestedBookmarks))
  })

  it('surfaces invalid JSON to the import UI', () => {
    expect(() => parseXBookmarks('[{"id":')).toThrow(SyntaxError)
  })
})
