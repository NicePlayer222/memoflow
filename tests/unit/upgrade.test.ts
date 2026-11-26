import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it, vi } from 'vitest'
import { InboxDatabase } from '../../src/db'
import { MockProvider } from '../../src/ai/provider'
import { ProcessingQueue } from '../../src/ai/queue'
import { demoData } from '../../src/seed/demoData'

it('upgrades an existing M1 inbox in place and preserves archived records during recovery', async () => {
  const name = crypto.randomUUID()
  const legacy = new Dexie(name)
  legacy.version(1).stores({ items: 'id, &fingerprint, importedAt' })
  const importedAt = '2026-10-01T00:00:00.000Z'
  const records = ['archived', 'processing', 'pending'].map((status, i) => ({
    ...demoData[i]!, id: crypto.randomUUID(), fingerprint: String(i), importedAt, status,
  }))
  await legacy.table('items').bulkAdd(records)
  legacy.close()

  const db = new InboxDatabase(name)
  const queue = new ProcessingQueue(db, new MockProvider(0))
  try {
    queue.start()
    await vi.waitFor(async () => {
      expect((await db.listItems()).filter(item => item.status === 'ready')).toHaveLength(2)
    })
    expect(await db.items.get(records[0]!.id)).toEqual(records[0])
    for (const previous of records.slice(1)) {
      expect(await db.items.get(previous.id)).toMatchObject({
        ...previous, status: 'ready', ai: { summary: expect.any(String) },
      })
    }
  } finally {
    await queue.stop()
    await db.delete()
  }
})
