import { useSyncExternalStore } from 'react'
import { db } from '../db'
import { ProcessingQueue } from './queue'
import { loadSettings, providerFor, saveSettings, settingsKey, type Settings } from './settings'

const pauseKey = 'memoflow.queue.paused'
const listeners = new Set<() => void>()
let state = { paused: false, error: '' }
let queue: ProcessingQueue | undefined

function publish(next: typeof state) {
  state = next
  for (const notify of listeners) notify()
}

export function reportQueueError(error: unknown) {
  publish({ ...state, error: error instanceof Error ? error.message : String(error) })
}

function applySettings(settings: Settings) {
  queue?.setProvider(providerFor(settings))
  queue?.setConcurrency(settings.concurrency)
}

function applyPause(paused: boolean) {
  if (paused) queue?.pause()
  else queue?.resume()
  publish({ ...state, paused })
}

export function startQueue() {
  try {
    const settings = loadSettings()
    queue = new ProcessingQueue(db, providerFor(settings), {
      concurrency: settings.concurrency, onError: reportQueueError,
    })
    applyPause(localStorage.getItem(pauseKey) === 'true')
    queue.start()
    window.addEventListener('storage', event => {
      try {
        if (event.key === pauseKey || event.key === null) applyPause(localStorage.getItem(pauseKey) === 'true')
        if (event.key === settingsKey || event.key === null) applySettings(loadSettings())
      } catch (error) { reportQueueError(error) }
    })
  } catch (error) { reportQueueError(error) }
}

export function configureQueue(settings: Settings) {
  applySettings(saveSettings(settings))
}

export function setPaused(paused: boolean) {
  localStorage.setItem(pauseKey, String(paused))
  applyPause(paused)
}

export async function retryFailed() {
  await queue?.retryFailed()
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => { listeners.delete(notify) }
}

export function useQueueState() {
  return useSyncExternalStore(subscribe, () => state)
}
