import { strToU8, zipSync } from 'fflate'
import type { InboxItem } from '../types/inbox'

function oneLine(text: string): string {
  return text.replace(/[\p{Cc}\s]+/gu, ' ').trim()
}

function noteBody(item: InboxItem, level: number): string {
  const heading = '#'.repeat(level)
  const section = heading + '#'
  const lines = [
    heading + ' ' + (oneLine(item.title) || '未命名'),
    '',
    '- 来源：' + item.source,
    '- 创建时间：' + item.createdAt,
  ]
  if (item.url) lines.push('- 链接：' + item.url)
  if (item.author) lines.push('- 作者：' + oneLine(item.author))
  if (item.folderPath?.length) lines.push('- 书签目录：' + item.folderPath.map(oneLine).join(' / '))
  if (item.ai) {
    const { category, tags, summary, takeaways, searchKeywords } = item.ai
    lines.push('', section + ' AI 整理', '', summary, '', '- 分类：' + category, '- 标签：' + tags.join('、'))
    if (searchKeywords.length) lines.push('- 搜索关键词：' + searchKeywords.join('、'))
    lines.push('', ...takeaways.map(point => '- ' + oneLine(point)))
  }
  if (item.rawContent) {
    lines.push('', section + ' 原始内容', '', item.rawContent.replace(/\r\n?/g, '\n').split('\n').map(line => '> ' + line).join('\n'))
  }
  return lines.join('\n')
}

export function exportMarkdown(items: InboxItem[]): string {
  return ['# MemoFlow 收件箱', ...items.map(item => noteBody(item, 2))].join('\n\n') + '\n'
}

// Double-quoted JSON strings and flow arrays are valid YAML. Escape the extra
// control characters that JSON allows literally but YAML readers can reject.
function yamlValue(value: string | string[] | null): string {
  return JSON.stringify(value).replace(/[\u007F-\u009F\u2028\u2029\uFFFE\uFFFF]/g, char =>
    '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'))
}

function frontmatter(item: InboxItem): string {
  const fields = {
    title: item.title, source: item.source, url: item.url ?? null, category: item.ai?.category ?? null,
    tags: item.ai?.tags ?? [], created: item.createdAt,
  }
  return ['---', ...Object.entries(fields).map(([key, value]) => key + ': ' + yamlValue(value)), '---'].join('\n')
}

function filenameStem(title: string): string {
  const safe = title.normalize('NFKC').replace(/[<>:"/\\|?*\p{Cc}]+/gu, '-').trim()
  // Leaving room for collision suffixes also keeps four-byte Unicode titles
  // within the common 255-byte per-component filesystem limit.
  const short = Array.from(safe).slice(0, 56).join('').replace(/^[. ]+|[. ]+$/g, '') || '未命名'
  return /^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9]|lpt[1-9]) *(?:\.|$)/i.test(short) ? '_' + short : short
}

export function exportObsidianZip(items: InboxItem[]): Uint8Array<ArrayBuffer> {
  const files: Record<string, Uint8Array> = {}
  const used = new Set<string>()
  for (const item of items) {
    const stem = filenameStem(item.title)
    let name = stem + '.md'
    let copy = 2
    while (used.has(name.toLowerCase())) name = stem + ' (' + copy++ + ').md'
    used.add(name.toLowerCase())
    files[name] = strToU8(frontmatter(item) + '\n\n' + noteBody(item, 1) + '\n')
  }
  return zipSync(files)
}
