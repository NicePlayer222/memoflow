import { liveQuery, type Subscription } from 'dexie'
import type { InboxDatabase } from '../db'
import type { InboxItem } from '../types/inbox'
import { ProviderHttpError, type AIProvider } from './provider'

interface QueueOptions {
  concurrency?: number
  retryDelayMs?: number
  onError?: (error: unknown) => void
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
    if (signal.aborted) done()
  })
}

export class ProcessingQueue {
  private concurrency = 2
  private paused = false
  private controller?: AbortController
  private subscription?: Subscription
  private running?: Promise<void>
  private requested = false
  private recover = true

  constructor(
    private readonly db: InboxDatabase,
    private provider: AIProvider,
    private readonly options: QueueOptions = {},
  ) {
    this.setConcurrency(options.concurrency ?? 2)
  }

  get isPaused() { return this.paused }

  setConcurrency(value: number) {
    this.concurrency = Number.isFinite(value) ? Math.max(1, Math.min(5, Math.floor(value))) : 2
    this.wake()
  }

  setProvider(provider: AIProvider) { this.provider = provider }
  pause() { this.paused = true }
  resume() { this.paused = false; this.wake() }

  start() {
    if (this.controller) return
    this.controller = new AbortController()
    this.recover = true
    this.subscription = liveQuery(() => this.db.items.where('status').equals('pending').count())
      .subscribe({
        next: count => { if (count && !this.paused) this.wake() },
        error: error => this.report(error),
      })
    this.wake()
  }

  async stop() {
    this.subscription?.unsubscribe()
    this.controller?.abort()
    this.controller = undefined
    await this.running
  }

  async retryFailed(id?: string) {
    const failed = this.db.items.where('status').equals('failed')
    await (id ? failed.filter(item => item.id === id) : failed).modify({
      status: 'pending', errorMessage: undefined,
    })
    this.wake()
  }

  private report(error: unknown) {
    if (this.options.onError) this.options.onError(error)
    else console.error(error)
  }

  private wake() {
    const signal = this.controller?.signal
    if (!signal) return
    if (this.running) {
      this.requested = true
      return
    }
    // Keep the lock through active work. A newly opened tab can only reset
    // abandoned "processing" records after the previous owner releases it.
    this.requested = false
    this.running = this.runWithLock(signal).catch(error => {
      if (!signal.aborted) this.report(error)
    }).finally(() => {
      this.running = undefined
      if (this.requested) this.wake()
    })
  }

  private async runWithLock(signal: AbortSignal) {
    await navigator.locks.request(`memoflow-queue:${this.db.name}`, { signal }, async () => {
      if (this.recover) {
        await this.db.items.where('status').equals('processing')
          .modify({ status: 'pending', processingToken: undefined })
        this.recover = false
      }
      await this.drain(signal)
    })
  }

  private async drain(signal: AbortSignal) {
    const active = new Set<Promise<void>>()
    try {
      while (!signal.aborted && !this.paused) {
        if (active.size < this.concurrency) {
          const item = await this.claim(signal)
          if (item) {
            const job = this.process(item, signal).catch(error => this.report(error))
              .finally(() => active.delete(job))
            active.add(job)
            continue
          }
        }
        if (!active.size) break
        await Promise.race(active)
      }
    } finally {
      await Promise.all(active)
    }
  }

  private claim(signal: AbortSignal) {
    return this.db.transaction('rw', this.db.items, async () => {
      const item = await this.db.items.where('status').equals('pending').first()
      if (!item || signal.aborted || this.paused) return
      item.status = 'processing'
      item.processingToken = crypto.randomUUID()
      delete item.errorMessage
      await this.db.items.put(item)
      return item
    })
  }

  private finish(item: InboxItem, changes: Partial<InboxItem>) {
    return this.db.items.where(':id').equals(item.id)
      .filter(row => row.status === 'processing' && row.processingToken === item.processingToken)
      .modify({ ...changes, processingToken: undefined })
  }

  private async process(item: InboxItem, signal: AbortSignal) {
    const provider = this.provider
    for (let attempt = 0; !signal.aborted; attempt++) {
      let ai: InboxItem['ai']
      try {
        ai = await provider.analyze(item, signal)
      } catch (error) {
        if (signal.aborted) break
        const transient = error instanceof ProviderHttpError
          ? error.status === 429 || (error.status >= 500 && error.status < 600)
          : error instanceof TypeError
        if (transient && attempt < 2) {
          await delay((this.options.retryDelayMs ?? 1000) * 2 ** attempt, signal)
          continue
        }
        await this.finish(item, { status: 'failed', errorMessage: error instanceof Error ? error.message : String(error) })
        return
      }
      if (signal.aborted) break
      await this.finish(item, { status: 'ready', ai })
      return
    }
    await this.finish(item, { status: 'pending' })
  }
}
