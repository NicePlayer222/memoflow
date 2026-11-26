import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDownToLine, ArrowUpRight, BookOpen, Database, FileText, Globe, Inbox, Layers, PenLine, Plus, Upload } from 'lucide-react'
import { db } from './db'
import { parseBrowserHtml } from './parsers/browserHtml'
import { parseMarkdownLinks } from './parsers/markdownLinks'
import { parseXBookmarks } from './parsers/xBookmarks'
import { demoData } from './seed/demoData'
import type { InboxDraft, Source } from './types/inbox'

const formats = {
  markdown: { label: 'Markdown / 纯链接', parse: parseMarkdownLinks },
  browser: { label: '浏览器书签 HTML', parse: parseBrowserHtml },
  x: { label: 'X 书签 JSON', parse: parseXBookmarks },
}
type Format = keyof typeof formats
const sources = {
  markdown: { label: 'Markdown', icon: FileText },
  browser: { label: '浏览器书签', icon: Globe },
  x: { label: 'X 书签', icon: BookOpen },
  manual: { label: '手记', icon: PenLine },
} satisfies Record<Source, unknown>

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export default function App() {
  const [format, setFormat] = useState<Format>('markdown')
  const [input, setInput] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const result = useLiveQuery(async () => {
    try {
      return { items: await db.listItems(), error: '' }
    } catch (error) {
      return { items: [], error: errorText(error) }
    }
  }, [])

  async function save(read: () => InboxDraft[] | Promise<InboxDraft[]>) {
    setBusy(true)
    setMessage('')
    try {
      const drafts = await read()
      if (!drafts.length) throw new Error('未找到可导入的条目，请检查内容和格式。')
      const { added, duplicates } = await db.importItems(drafts)
      setMessage(`已新增 ${added} 条，重复 ${duplicates} 条。`)
    } catch (error) {
      setMessage(`导入失败：${errorText(error)}`)
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
    <>
      <header className="masthead">
        <div className="frame flex items-center justify-between">
          <div className="brand"><span className="brand-icon"><Layers size={21} /></span>MemoFlow</div>
          <span className="local"><Database size={14} /> 本地存储</span>
        </div>
      </header>
      <main className="frame">
        <div className="page-title">
          <h1>碎片收件箱</h1>
          <button className="secondary" disabled={busy} onClick={() => void save(() => demoData)}>
            <Plus size={16} /> 加载演示数据
          </button>
        </div>
        <div className="workspace">
          <section className="panel import-panel" aria-labelledby="import-heading">
            <h2 id="import-heading"><ArrowDownToLine size={19} /> 导入碎片</h2>
            <label htmlFor="format">粘贴格式</label>
            <select id="format" value={format} onChange={e => setFormat(e.target.value as Format)}>
              {Object.entries(formats).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}
            </select>
            <label htmlFor="content">内容</label>
            <textarea id="content" rows={6} value={input} onChange={e => setInput(e.target.value)}
              placeholder={format === 'markdown' ? '[标题](https://…) 或每行一个网址' : format === 'browser' ? '粘贴浏览器导出的书签 HTML' : '粘贴 X 书签 JSON'} />
            <button className="primary" disabled={busy || !input.trim()} onClick={() => void save(() => formats[format].parse(input))}>
              <ArrowDownToLine size={15} /> 导入粘贴内容
            </button>
            <div className="file-section">
              <button className="upload" disabled={busy} onClick={() => fileInput.current?.click()}>
                <Upload size={16} /> 选择文件导入
              </button>
              <span>支持 .json、.html、.md、.txt</span>
              <input type="file" hidden ref={fileInput} accept=".json,.htm,.html,.md,.txt"
                onChange={e => { upload(e.target.files?.[0]); e.target.value = '' }} />
            </div>
            <p role="status" className="feedback">{busy ? '正在导入…' : message}</p>
          </section>
          <section className="panel collection" aria-labelledby="list-heading">
            <div className="collection-heading">
              <h2 id="list-heading"><Inbox size={19} /> 已收录</h2>
              <span>{result && !result.error ? `${result.items.length} 条记录` : '—'}</span>
            </div>
            {!result ? <p className="empty">正在读取收件箱…</p>
              : result.error ? <p className="empty" role="alert">读取失败：{result.error}</p>
              : result.items.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon"><Inbox size={32} strokeWidth={1.4} /></div>
                  <h3>收件箱还是空的</h3>
                  <p>导入第一份书签，或加载 20 条演示碎片。</p>
                </div>
              ) : <ul>{result.items.map(item => {
                const { label, icon: Icon } = sources[item.source]
                return <li key={item.id}>
                  <span className="item-source"><Icon size={13} /> {label}{item.folderPath?.length ? ' · ' + item.folderPath.join(' / ') : ''}</span>
                  <h3>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title} <ArrowUpRight size={14} /></a> : item.title}</h3>
                  {item.rawContent && item.rawContent !== item.title && <p>{item.rawContent}</p>}
                </li>
              })}</ul>}
          </section>
        </div>
      </main>
    </>
  )
}
