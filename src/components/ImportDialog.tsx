import { useRef, useState } from 'react'
import { ArrowDownToLine, FileUp, Layers } from 'lucide-react'
import { db } from '../db'
import { parseBrowserHtml } from '../parsers/browserHtml'
import { parseMarkdownLinks } from '../parsers/markdownLinks'
import { parseXBookmarks } from '../parsers/xBookmarks'
import { demoData } from '../seed/demoData'
import type { InboxDraft } from '../types/inbox'
import { Dialog } from './Dialog'

const formats = {
  markdown: { label: 'Markdown / 纯链接', parse: parseMarkdownLinks, hint: '[标题](https://…) 或每行一个网址' },
  browser: { label: '浏览器书签 HTML', parse: parseBrowserHtml, hint: '粘贴浏览器导出的书签 HTML' },
  x: { label: 'X 书签 JSON', parse: parseXBookmarks, hint: '粘贴 X 书签 JSON' },
}
type Format = keyof typeof formats

export function ImportDialog({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const [format, setFormat] = useState<Format>('markdown')
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function save(read: () => InboxDraft[] | Promise<InboxDraft[]>) {
    setBusy(true)
    setError('')
    try {
      const drafts = await read()
      if (!drafts.length) throw new Error('未找到可导入的条目，请检查内容和格式。')
      const { added, duplicates } = await db.importItems(drafts)
      notify(`已新增 ${added} 条，重复 ${duplicates} 条。`)
      onClose()
    } catch (cause) {
      setError(`导入失败：${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      setBusy(false)
    }
  }

  function upload(file?: File) {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    const kind = ext === 'json' ? 'x' : ext === 'html' || ext === 'htm' ? 'browser'
      : ext === 'md' || ext === 'txt' ? 'markdown' : format
    void save(async () => formats[kind].parse(await file.text()))
  }

  return (
    <Dialog title="导入碎片" onClose={() => { if (!busy) onClose() }}>
      <form onSubmit={event => { event.preventDefault(); void save(() => formats[format].parse(input)) }}>
        <label className="mf-field">粘贴格式
          <select disabled={busy} value={format} onChange={event => setFormat(event.target.value as Format)}>
            {Object.entries(formats).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </label>
        <label className="mf-field">内容
          <textarea disabled={busy} rows={5} value={input} placeholder={formats[format].hint}
            onChange={event => setInput(event.target.value)} />
        </label>
        <button type="submit" className="mf-action mf-confirm" disabled={busy || !input.trim()}>
          <ArrowDownToLine size={15} /> 导入粘贴内容
        </button>
      </form>
      <div className="mf-import-options">
        <button type="button" className="mf-action" disabled={busy} onClick={() => fileInput.current?.click()}>
          <FileUp size={15} /> 选择文件导入
        </button>
        <input type="file" aria-label="导入书签文件" hidden ref={fileInput} accept=".json,.html,.htm,.md,.txt"
          onChange={event => { upload(event.target.files?.[0]); event.target.value = '' }} />
        <button type="button" className="mf-action" disabled={busy} onClick={() => void save(() => demoData)}>
          <Layers size={15} /> 加载演示数据
        </button>
      </div>
      {busy && <p role="status" className="mf-hint">正在导入…</p>}
      {error && <p role="alert" className="mf-form-error">{error}</p>}
    </Dialog>
  )
}
