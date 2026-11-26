import type { InboxDraft } from '../types/inbox'
import { normalizeUrl } from './normalizeUrl'

export function parseBrowserHtml(text: string): InboxDraft[] {
  // Template contents stay inert, including images, scripts and iframe URLs.
  const template = document.createElement('template')
  template.innerHTML = text

  const items: InboxDraft[] = []
  const paths = new Map<Element, string[]>()
  let heading: Element | undefined

  for (const node of template.content.querySelectorAll('h3, dl, dt > a')) {
    const parentList = node.parentElement?.closest('dl') ?? null
    const path = parentList ? paths.get(parentList) ?? [] : []
    if (node.localName === 'h3') {
      heading = node
      continue
    }
    if (node.localName === 'dl') {
      // Exporters may place the child DL inside the folder's DT or after it.
      const folder = heading?.textContent?.trim()
      paths.set(node, folder && heading?.closest('dl') === parentList ? [...path, folder] : path)
      heading = undefined
      continue
    }

    heading = undefined
    const url = node.getAttribute('href')?.trim()
    if (!url || !normalizeUrl(url)) continue
    const title = node.textContent?.trim() || url
    const description = node.parentElement?.nextElementSibling
    const note = description?.localName === 'dd' ? description.textContent?.trim() : ''
    const item: InboxDraft = {
      source: 'browser',
      url,
      title,
      rawContent: note ? `${title}\n${note}` : title,
      folderPath: path,
    }
    const seconds = node.getAttribute('add_date')
    if (seconds && /^\d+$/.test(seconds)) {
      const date = new Date(Number(seconds) * 1000)
      if (Number.isFinite(date.getTime())) item.createdAt = date.toISOString()
    }
    items.push(item)
  }
  return items
}
