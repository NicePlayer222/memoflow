import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MockProvider } from '../../src/ai/provider'
import { InboxDatabase } from '../../src/db'
import { clearInbox, makeBackup, restoreBackup } from '../../src/export/backupJson'
import { demoData } from '../../src/seed/demoData'

let db: InboxDatabase
beforeEach(() => { db = new InboxDatabase(crypto.randomUUID()) })
afterEach(async () => { await db.delete() })

describe('versioned JSON backup and restore', () => {
  it('round-trips 100% of the JSON fields for 20 items after clearing and reopening IndexedDB', async () => {
    await db.importItems(demoData)
    const items = await db.listItems()
    const mock = new MockProvider(0)
    for (const [i, item] of items.entries()) {
      if (i % 4 === 1) await db.items.update(item.id, { ai: await mock.analyze(item), status: 'ready' })
      if (i % 4 === 2) await db.items.update(item.id, { ai: { ...await mock.analyze(item), tags: ['合并后的主题'] }, status: 'archived' })
      if (i % 4 === 3) await db.items.update(item.id, { status: 'failed', errorMessage: 'HTTP 401' })
    }
    const original = makeBackup(await db.listItems())
    expect(Object.keys(JSON.parse(original))).toEqual(['format', 'version', 'items'])
    await clearInbox(db)
    expect(await db.items.count()).toBe(0)
    await db.importItems([{ source: 'manual', title: 'restored backup replaces this', rawContent: '' }])
    expect(await restoreBackup(db, original)).toBe(20)
    db.close()
    await db.open()
    expect(makeBackup(await db.listItems())).toBe(original)
  })

  it('resumes an interrupted processing record as pending without its abandoned claim', async () => {
    await db.importItems(demoData.slice(0, 1))
    const [item] = await db.listItems()
    const backup = makeBackup([{ ...item!, status: 'processing', processingToken: 'old-tab-claim' }])
    await restoreBackup(db, backup)
    expect(await db.items.get(item!.id)).toEqual(item)
    expect((await db.items.get(item!.id))?.processingToken).toBeUndefined()
  })

  it('rejects unrecognized, malformed or damaged backups before replacing existing records', async () => {
    await db.importItems(demoData.slice(0, 2))
    const before = await db.listItems()
    const valid = JSON.parse(makeBackup(before))
    const first = valid.items[0]
    const badRows = [
      null, { ...first, id: 'no uuid' }, { ...first, status: 'busy' }, { ...first, source: 'rss' },
      { ...first, ai: { tags: 'wrong type' } }, { ...first, rawContent: false },
      { ...first, folderPath: [3] }, { ...first, importedAt: 'yesterday' },
      { ...first, fingerprint: 'a'.repeat(64) }, { ...first, canonicalUrl: 'file:///tmp/oops' },
      { ...first, url: 'javascript:alert(1)' },
    ]
    for (const text of [
      '{invalid', '{}', JSON.stringify({ ...valid, version: 7 }),
      ...badRows.map(row => JSON.stringify({ ...valid, items: [valid.items[1], row] })),
      JSON.stringify({ ...valid, items: [first, { ...first, id: crypto.randomUUID() }] }),
      JSON.stringify({ ...valid, items: [first, { ...valid.items[1], id: first.id }] }),
    ]) {
      await expect(restoreBackup(db, text)).rejects.toThrow()
      expect(await db.listItems()).toEqual(before)
    }
  })

  it('rolls back both the clear and successful writes when IndexedDB rejects a row', async () => {
    await db.importItems(demoData.slice(0, 1))
    const before = await db.listItems()
    const other = new InboxDatabase(crypto.randomUUID())
    try {
      await other.importItems(demoData.slice(1, 4))
      const replacement = await other.listItems()
      db.items.hook('creating', (_id, item) => {
        if (item.id === replacement[1]!.id) throw new Error('simulated storage error')
      })
      await expect(restoreBackup(db, makeBackup(replacement))).rejects.toThrow('simulated storage error')
      expect(await db.listItems()).toEqual(before)
    } finally { await other.delete() }
  })

  it('recognizes an intentionally empty backup', async () => {
    await db.importItems(demoData.slice(0, 1))
    expect(await restoreBackup(db, makeBackup([]))).toBe(0)
    expect(await db.items.count()).toBe(0)
  })
})
