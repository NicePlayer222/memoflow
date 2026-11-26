import { validateAnalysis } from '../ai/schema'
import { identify, type InboxDatabase } from '../db'
import type { InboxItem } from '../types/inbox'

export function makeBackup(items: InboxItem[]): string {
  return JSON.stringify({ format: 'memoflow', version: 1, items }, null, 2)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isDate(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function validateRow(row: unknown): asserts row is InboxItem {
  if (!isRecord(row)) throw new Error('条目应为 JSON 对象。')
  if (typeof row.id !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(row.id)) {
    throw new Error('id 应为 UUID。')
  }
  if (typeof row.fingerprint !== 'string' || !/^[\da-f]{64}$/.test(row.fingerprint)) {
    throw new Error('fingerprint 应为 SHA-256 摘要。')
  }
  if (typeof row.source !== 'string' || !['x', 'browser', 'markdown', 'manual'].includes(row.source)) {
    throw new Error('未知来源。')
  }
  if (typeof row.status !== 'string' || !['pending', 'processing', 'ready', 'failed', 'archived'].includes(row.status)) {
    throw new Error('未知处理状态。')
  }
  if (typeof row.title !== 'string' || typeof row.rawContent !== 'string') throw new Error('标题和正文应为文本。')
  if (!isDate(row.createdAt) || !isDate(row.importedAt)) throw new Error('创建或导入时间无效。')
  for (const name of ['url', 'canonicalUrl', 'author', 'errorMessage', 'processingToken']) {
    if (name in row && typeof row[name] !== 'string') throw new Error(`${name} 应为文本。`)
  }
  if (row.url === '') throw new Error('链接不能为空。')
  if ('folderPath' in row && (!Array.isArray(row.folderPath) || !row.folderPath.every(part => typeof part === 'string'))) {
    throw new Error('folderPath 应为路径名称数组。')
  }
  if ('ai' in row) {
    if (!isRecord(row.ai)) throw new Error('ai 应为 JSON 对象。')
    const { summary, category, tags, takeaways, searchKeywords, processedAt, model } = row.ai
    if (!isDate(processedAt) || typeof model !== 'string' || !model.trim()) throw new Error('AI 模型或分析时间无效。')
    // A tag merge can leave a valid saved analysis with a single label.
    validateAnalysis({ summary, category, tags, takeaways, searchKeywords }, 1)
  }
}

export async function restoreBackup(db: InboxDatabase, text: string): Promise<number> {
  let backup: unknown
  try { backup = JSON.parse(text) } catch { throw new Error('备份文件包含无效的 JSON。') }
  if (!isRecord(backup) || backup.format !== 'memoflow' || backup.version !== 1 || !Array.isArray(backup.items)) {
    throw new Error('无法识别 MemoFlow 备份格式或版本。')
  }
  const ids = new Set<string>()
  const fingerprints = new Set<string>()
  const rows = await Promise.all(backup.items.map(async (row: unknown, i: number) => {
    try {
      validateRow(row)
      if (ids.has(row.id.toLowerCase()) || fingerprints.has(row.fingerprint)) throw new Error('备份中含重复的 ID 或内容指纹。')
      ids.add(row.id.toLowerCase())
      fingerprints.add(row.fingerprint)
      const identity = await identify(row)
      if (identity.fingerprint !== row.fingerprint || identity.canonicalUrl !== row.canonicalUrl) {
        throw new Error('原始内容与指纹或规范链接不一致。')
      }
      if (row.status === 'processing') {
        row.status = 'pending'
        delete row.processingToken
      }
      return row
    } catch (error) {
      throw new Error(`备份第 ${i + 1} 条无效：${error instanceof Error ? error.message : String(error)}`)
    }
  }))
  await db.transaction('rw', db.items, async () => {
    await db.items.clear()
    await db.items.bulkAdd(rows)
  })
  return rows.length
}

export async function clearInbox(db: InboxDatabase): Promise<void> {
  await db.items.clear()
}
