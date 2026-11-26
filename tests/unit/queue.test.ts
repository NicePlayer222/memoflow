import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockProvider, ProviderHttpError, type AIProvider } from '../../src/ai/provider'
import { ProcessingQueue } from '../../src/ai/queue'
import { InboxDatabase } from '../../src/db'
import { demoData } from '../../src/seed/demoData'
import type { InboxItem, Status } from '../../src/types/inbox'

let db: InboxDatabase
let queues: ProcessingQueue[]
let errors: unknown[]
const mock = new MockProvider(0)
const tick = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function queue(provider: AIProvider = mock, concurrency?: number, retryDelayMs = 5) {
  const result = new ProcessingQueue(db, provider, { concurrency, retryDelayMs, onError: error => errors.push(error) })
  queues.push(result)
  return result
}

function count(status: Status, expected: number) {
  return vi.waitFor(async () => expect(await db.items.where('status').equals(status).count()).toBe(expected),
    { timeout: 4000, interval: 10 })
}

beforeEach(() => {
  db = new InboxDatabase(crypto.randomUUID())
  queues = []
  errors = []
})
afterEach(async () => {
  await Promise.all(queues.map(service => service.stop()))
  await db.delete()
  expect(errors).toEqual([])
})

describe('persistent processing queue', () => {
  it('wakes on a later import and completes the 20 demo items in Mock mode', async () => {
    queue().start()
    await tick(30)
    await db.importItems(demoData)
    await count('ready', 20)
    for (const record of await db.listItems()) {
      expect(record.ai?.summary).toBeTruthy()
      expect(record.processingToken).toBeUndefined()
    }
  })

  it.each([[undefined, 2], [10, 5]])('limits concurrency (%s → %i) even with two open queues', async (requested, limit) => {
    let active = 0
    let peak = 0
    const seen = new Set<string>()
    const provider: AIProvider = {
      async analyze(item) {
        active++
        peak = Math.max(active, peak)
        expect(seen.has(item.id)).toBe(false)
        seen.add(item.id)
        await tick(20)
        active--
        return mock.analyze(item)
      },
    }
    await db.importItems(demoData)
    queue(provider, requested).start()
    queue(provider, requested).start()
    await count('ready', 20)
    expect(peak).toBe(limit)
    expect(seen.size).toBe(20)
  })

  it('retries 429 then 503 with exponential delays and succeeds on attempt three', async () => {
    const delays: number[] = []
    const originalTimer = globalThis.setTimeout
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback, ms, ...args) => {
      if (ms === 27 || ms === 54) delays.push(ms)
      return originalTimer(callback, ms, ...args)
    })
    try {
      const analyze = vi.fn((item: InboxItem) => mock.analyze(item))
        .mockRejectedValueOnce(new ProviderHttpError(429))
        .mockRejectedValueOnce(new ProviderHttpError(503))
      await db.importItems(demoData.slice(0, 1))
      queue({ analyze }, 1, 27).start()
      await count('ready', 1)
      expect(analyze).toHaveBeenCalledTimes(3)
      expect(delays).toEqual([27, 54])
    } finally { timer.mockRestore() }
  })

  it('isolates permanent failures, stops after two network retries, and retries failed jobs on demand', async () => {
    const calls = new Map<string, number>()
    const analyze = async (item: InboxItem) => {
      calls.set(item.title, (calls.get(item.title) ?? 0) + 1)
      if (item.title === 'offline') throw new TypeError('offline')
      if (item.title === 'denied') throw new ProviderHttpError(401)
      return mock.analyze(item)
    }
    await db.importItems(['ok', 'offline', 'denied'].map(title => ({ source: 'manual', title, rawContent: title })))
    const service = queue({ analyze })
    service.start()
    await count('failed', 2)
    await count('ready', 1)
    expect(Object.fromEntries(calls)).toEqual({ ok: 1, offline: 3, denied: 1 })
    const failed = await db.items.where('status').equals('failed').toArray()
    expect(failed.every(item => item.errorMessage)).toBe(true)
    service.setProvider(mock)
    await service.retryFailed(failed[0]!.id)
    await count('ready', 2)
    await service.retryFailed()
    await count('ready', 3)
  })

  it('resets abandoned processing on reload while paused and proceeds after resume', async () => {
    await db.importItems(demoData.slice(0, 2))
    const [first, second] = await db.listItems()
    await db.items.update(first!.id, { status: 'processing', processingToken: 'previous-tab' })
    await db.items.update(second!.id, { status: 'archived' })
    db.close()
    await db.open()
    const service = queue()
    service.pause()
    service.start()
    await count('pending', 1)
    expect((await db.items.get(first!.id))?.processingToken).toBeUndefined()
    expect(await db.items.where('status').equals('ready').count()).toBe(0)
    service.resume()
    await count('ready', 1)
    await count('archived', 1)
  })

  it('keeps archived, edited, and restored records safe from in-flight results', async () => {
    await db.importItems(demoData.slice(0, 3))
    let release!: () => void
    const deferred = new Promise<void>(resolve => { release = resolve })
    const service = queue({ async analyze(item) { await deferred; return mock.analyze(item) } }, 3)
    service.start()
    try {
      await count('processing', 3)
      service.pause()
      const [archived, edited, restored] = await db.listItems()
      await db.updateItem(archived!.id, { status: 'archived' })
      await db.updateItem(edited!.id, { title: 'updated content' })
      await db.items.put({ ...restored!, status: 'ready', processingToken: undefined })
    } finally { release() }
    // A queued lock is granted only after all old provider results were handled.
    await navigator.locks.request(`memoflow-queue:${db.name}`, () => {})
    await count('archived', 1)
    await count('pending', 1)
    await count('ready', 1)
    expect((await db.listItems()).every(item => !item.ai)).toBe(true)
  })
})
