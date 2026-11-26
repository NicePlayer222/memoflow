import type { InboxDatabase } from './index'
import type { InboxItem } from '../types/inbox'

export function tagCounts(items: InboxItem[]) {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const tag of new Set(item.ai?.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return counts
}

export async function renameTag(db: InboxDatabase, from: string, to: string) {
  const oldName = from.trim(), newName = to.trim()
  if (!oldName || !newName) throw new Error('标签名称不能为空。')
  if (oldName === newName) return 0
  return db.transaction('rw', db.items, () => db.items.filter(item => !!item.ai?.tags.includes(oldName))
    .modify(item => {
      if (item.ai) item.ai.tags = [...new Set(item.ai.tags.map(tag => tag === oldName ? newName : tag))]
    }))
}
