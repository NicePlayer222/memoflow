import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { InboxDatabase } from '../../src/db'
import { demoData } from '../../src/seed/demoData'
import type { InboxDraft } from '../../src/types/inbox'

let inbox: InboxDatabase
const note: InboxDraft = { source: 'manual', title: '随手记', rawContent: 'Lunch in Zürich' }
const link: InboxDraft = { source: 'browser', title: '第一份', rawContent: '批注', url: 'https://EXAMPLE.org/Docs/?utm_source=reader' }

beforeEach(() => { inbox = new InboxDatabase(crypto.randomUUID()) })
afterEach(async () => { await inbox.delete() })

describe('IndexedDB inbox', () => {
  it('deduplicates within and across imports, keeping the original source and metadata', async () => {
    const later: InboxDraft = { ...link, source: 'markdown', title: '第二份', url: 'https://example.org/Docs' }
    expect(await inbox.importItems([link, later, note])).toEqual({ added: 2, duplicates: 1 })
    expect(await inbox.importItems([later])).toEqual({ added: 0, duplicates: 1 })
    const [saved] = (await inbox.listItems()).filter(item => item.url)
    expect(saved).toMatchObject({ ...link, status: 'pending', canonicalUrl: later.url })
    expect(saved?.id).toMatch(/^[a-f0-9-]{36}$/)
    expect(saved?.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(saved?.createdAt).toBe(saved?.importedAt)
  })

  it('deduplicates normalized text without collapsing distinct content or URL fragments', async () => {
    const similar = { ...note, rawContent: ' Lunch   in Zu\u0308rich ' }
    const different = { ...note, rawContent: 'Dinner in Zürich' }
    expect(await inbox.importItems([note, similar, different, link, { ...link, url: link.url + '#chapter' }]))
      .toEqual({ added: 4, duplicates: 1 })
  })

  it('serializes overlapping imports from two connections', async () => {
    const other = new InboxDatabase(inbox.name)
    try {
      const counts = await Promise.all([inbox.importItems([note]), other.importItems([note])])
      expect(counts.map(result => result.added).sort()).toEqual([0, 1])
      expect(await inbox.items.count()).toBe(1)
    } finally {
      other.close()
    }
  })

  it('supports reading, editing, deleting and reimporting the old identity', async () => {
    await inbox.importItems([link])
    const [record] = await inbox.listItems()
    if (!record) throw new Error('Missing imported row')
    await inbox.updateItem(record.id, { url: 'https://example.org/other/', status: 'archived' })
    expect(await inbox.items.get(record.id)).toMatchObject({
      canonicalUrl: 'https://example.org/other', status: 'archived', importedAt: record.importedAt,
    })
    expect(await inbox.importItems([link])).toEqual({ added: 1, duplicates: 0 })
    await inbox.deleteItem(record.id)
    expect(await inbox.items.get(record.id)).toBeUndefined()
    await expect(inbox.updateItem(record.id, { title: 'Too late' })).rejects.toThrow('条目不存在')
  })

  it('preserves both records when an edit conflicts with an existing fingerprint', async () => {
    await inbox.importItems([note, link])
    const records = await inbox.listItems()
    const textOnly = records.find(item => !item.url)!
    await expect(inbox.updateItem(textOnly.id, { url: link.url })).rejects.toMatchObject({ name: 'ConstraintError' })
    expect(await inbox.listItems()).toEqual(records)
  })

  it('rejects invalid drafts without partially importing a batch', async () => {
    await expect(inbox.importItems([note, { ...link, url: 'file:///tmp/local' }])).rejects.toThrow('HTTP')
    await expect(inbox.importItems([{ ...note, title: ' ', rawContent: '' }])).rejects.toThrow('内容')
    expect(await inbox.items.count()).toBe(0)
    expect(await inbox.importItems([])).toEqual({ added: 0, duplicates: 0 })
  })

  it('loads all 20 demo items exactly once and retains them when the database is reopened', async () => {
    expect(await inbox.importItems(demoData)).toEqual({ added: 20, duplicates: 0 })
    inbox.close()
    await inbox.open()
    expect(await inbox.importItems(demoData)).toEqual({ added: 0, duplicates: 20 })
    expect(await inbox.items.count()).toBe(20)
  })
})
