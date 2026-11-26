import Dexie, { type Table } from 'dexie'
import { normalizeUrl } from '../parsers/normalizeUrl'
import type { InboxDraft, InboxItem } from '../types/inbox'

async function identify(draft: InboxDraft) {
  const canonicalUrl = draft.url ? normalizeUrl(draft.url) : undefined
  if (draft.url && !canonicalUrl) throw new Error('链接必须是有效的 HTTP 或 HTTPS 地址。')
  if (!canonicalUrl && !draft.title.trim() && !draft.rawContent.trim()) {
    throw new Error('条目缺少可保存的内容。')
  }
  const cleanText = (value: string) => value.normalize('NFC').trim().replace(/\s+/gu, ' ')
  const identity = canonicalUrl
    ? ['url', canonicalUrl]
    : ['text', cleanText(draft.title), cleanText(draft.rawContent)]
  const bytes = new TextEncoder().encode(JSON.stringify(identity))
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const fingerprint = Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('')
  return { canonicalUrl, fingerprint }
}

export class InboxDatabase extends Dexie {
  items!: Table<InboxItem, string>

  constructor(name = 'memoflow') {
    super(name)
    this.version(1).stores({ items: 'id, &fingerprint, importedAt' })
    this.version(2).stores({ items: 'id, &fingerprint, importedAt, status' })
  }

  async importItems(drafts: InboxDraft[]) {
    const importedAt = new Date().toISOString()
    const candidates = await Promise.all(drafts.map(async (draft): Promise<InboxItem> => ({
      ...draft,
      ...await identify(draft),
      id: crypto.randomUUID(),
      createdAt: draft.createdAt ?? importedAt,
      importedAt,
      status: 'pending',
    })))

    // Keep the first occurrence, including its title and folder metadata.
    const unique = new Map<string, InboxItem>()
    for (const item of candidates) {
      if (!unique.has(item.fingerprint)) unique.set(item.fingerprint, item)
    }
    return this.transaction('rw', this.items, async () => {
      const fingerprints = [...unique.keys()]
      const stored = await this.items.where('fingerprint').anyOf(fingerprints).keys()
      for (const fingerprint of stored) unique.delete(String(fingerprint))
      await this.items.bulkAdd([...unique.values()])
      return { added: unique.size, duplicates: drafts.length - unique.size }
    })
  }

  listItems() {
    return this.items.orderBy('importedAt').reverse().toArray()
  }

  async updateItem(id: string, changes: Partial<InboxDraft & Pick<InboxItem, 'status' | 'errorMessage'>>) {
    return this.transaction('rw', this.items, async () => {
      const original = await this.items.get(id)
      if (!original) throw new Error('条目不存在。')
      const item = { ...original, ...changes }
      const contentChanged = Object.keys(changes).some(key => key !== 'status' && key !== 'errorMessage')
      if (contentChanged || changes.status === 'pending') {
        item.status = changes.status ?? (original.status === 'archived' ? 'archived' : 'pending')
        delete item.ai
        delete item.errorMessage
      }
      if (contentChanged || item.status !== 'processing') delete item.processingToken
      // Web Crypto runs outside IndexedDB. Keep the transaction alive while hashing.
      const identity = await Dexie.waitFor(identify(item))
      await this.items.put({ ...item, ...identity })
    })
  }

  deleteItem(id: string) {
    return this.items.delete(id)
  }
}

export const db = new InboxDatabase()
