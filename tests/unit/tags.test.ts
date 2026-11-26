import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { InboxDatabase } from '../../src/db'
import { renameTag, tagCounts } from '../../src/db/tags'
import type { InboxItem } from '../../src/types/inbox'

const stamp = '2026-01-02T00:00:00.000Z'
let db: InboxDatabase
beforeEach(() => { db = new InboxDatabase(crypto.randomUUID()) })
afterEach(async () => { await db.delete() })

function note(id: string, tags?: string[], status: InboxItem['status'] = 'ready'): InboxItem {
  return {
    id, source: 'manual', title: id, rawContent: 'reading notes', fingerprint: id,
    createdAt: stamp, importedAt: stamp, status,
    ai: tags && { tags, category: '人工智能', summary: 'notes', model: 'mock', processedAt: stamp,
      takeaways: ['one'], searchKeywords: ['AI', '学习', 'reading'] },
  }
}

it('counts a tag once per item, including archived records', () => {
  const items = [note('a', ['AI', 'AI']), note('b', ['AI', '阅读'], 'archived'), note('c', undefined, 'pending')]
  expect(tagCounts(items)).toEqual(new Map([['AI', 2], ['阅读', 1]]))
})

it('merges existing tags across statuses, preserving unrelated data and order', async () => {
  const ready = note('a', ['阅读', 'AI', '人工智能'])
  const archived = note('b', ['AI', '记录'], 'archived')
  const unaffected = note('c', ['人工智能', '同义词'])
  await db.items.bulkAdd([ready, archived, unaffected])
  expect(await renameTag(db, ' AI ', ' 人工智能 ')).toBe(2)
  expect(await db.items.get('a')).toEqual({ ...ready, ai: { ...ready.ai, tags: ['阅读', '人工智能'] } })
  expect(await db.items.get('b')).toEqual({ ...archived, ai: { ...archived.ai, tags: ['人工智能', '记录'] } })
  expect(await db.items.get('c')).toEqual(unaffected)
  expect(await renameTag(db, 'AI', '人工智能')).toBe(0)
})

it('renames to a new label, rejects blanks and ignores a normalized no-op', async () => {
  await db.items.add(note('a', ['nature', '漫步']))
  expect(await renameTag(db, 'nature', '自然')).toBe(1)
  expect(await renameTag(db, '自然', ' 自然 ')).toBe(0)
  await expect(renameTag(db, '自然', '  ')).rejects.toThrow()
  await expect(renameTag(db, '  ', '自然')).rejects.toThrow()
  expect((await db.items.get('a'))?.ai?.tags).toEqual(['自然', '漫步'])
})

it('rolls back every tag update when a later write fails', async () => {
  const originals = [note('a', ['AI', 'notes']), note('b', ['AI', 'walk'])]
  await db.items.bulkAdd(originals)
  const failSecond = (_changes: unknown, key: string) => {
    if (key === 'b') throw new Error('Simulated write failure')
  }
  db.items.hook('updating').subscribe(failSecond)
  try {
    await expect(renameTag(db, 'AI', '人工智能')).rejects.toThrow()
    expect(await db.items.toArray()).toEqual(originals)
  } finally {
    db.items.hook('updating').unsubscribe(failSecond)
  }
})
