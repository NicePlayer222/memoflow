import { useState } from 'react'
import { Archive, ArrowUpRight, Check, FileText, ListChecks, Pencil, RotateCcw, X } from 'lucide-react'
import { db } from '../db'
import type { InboxItem } from '../types/inbox'

interface Props {
  item: InboxItem
  onArchive: () => void
  onRequeue: () => void
  onClose: () => void
  notify: (message: string) => void
}

export function DetailPane({ item, onArchive, onRequeue, onClose, notify }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [body, setBody] = useState(item.rawContent)
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true)
    try {
      await db.updateItem(item.id, { title: title.trim(), rawContent: body })
      setEditing(false)
      notify('已保存修改')
    } catch (error) { notify(error instanceof Error ? error.message : String(error)) }
    finally { setSaving(false) }
  }

  return <>
    <div className="pane-head"><span><FileText size={16} />条目详情</span><div className="inline-actions">
      <button aria-label="编辑条目" title="编辑条目" onClick={() => { setTitle(item.title); setBody(item.rawContent); setEditing(true) }}><Pencil /></button>
      <button onClick={onClose} aria-label="关闭详情" className="narrow-only"><X /></button>
    </div></div>
    <div className="detail-body">
      {editing ? <form className="edit-form" onSubmit={e => { e.preventDefault(); void save() }}>
        <label>标题<input value={title} onChange={e => setTitle(e.target.value)} required autoFocus /></label>
        <label>原文与笔记<textarea value={body} onChange={e => setBody(e.target.value)} rows={8} /></label>
        <div className="inline-actions"><button className="primary" disabled={saving || !title.trim()}><Check size={14}/>保存</button>
        <button type="button" className="outline" disabled={saving} onClick={() => setEditing(false)}>取消</button></div>
      </form> : <>
        <div className="detail-date">{new Date(item.createdAt).toLocaleDateString('zh-CN', {year:'numeric',month:'long',day:'numeric'})}</div>
        <h2 data-testid="detail-title">{item.title}</h2>
        {item.url && <a className="source-link" href={item.url} target="_blank" rel="noreferrer">{new URL(item.url).hostname}<ArrowUpRight size={14}/></a>}
        <div className="inline-actions detail-actions">
          <button className="outline" onClick={onArchive}><Archive size={14}/>{item.status === 'archived' ? '取消归档' : '归档'}<kbd>E</kbd></button>
          <button className="outline" onClick={onRequeue}><RotateCcw size={14}/>重新整理<kbd>R</kbd></button>
        </div>
        {!item.ai && (item.status === 'processing' || item.status === 'pending') && <p className="detail-date" role="status">
          {item.status === 'processing' ? '正在整理，完成后将在这里显示摘要。' : '等待队列整理，原文可先行阅读。'}
        </p>}
        {item.ai && <section className="analysis-card"><h3><ListChecks size={16}/>整理摘要</h3><p>{item.ai.summary}</p>
          <ul>{item.ai.takeaways.map((value, i) => <li key={i}>{value}</li>)}</ul>
          <div className="tags">{item.ai.tags.map((tag, i) => <span key={i}># {tag}</span>)}</div>
        </section>}
        {item.errorMessage && <p role="alert" className="error">{item.errorMessage}</p>}
        <section className="detail-section"><h3>原文与笔记</h3><p className="original">{item.rawContent || '仅保存了链接。'}</p></section>
        {item.folderPath?.length ? <p className="detail-date">文件夹 · {item.folderPath.join(' / ')}</p> : null}
        {item.author && <p className="detail-date">作者 · {item.author}</p>}
        {item.ai && <section className="detail-section"><h3>检索扩展词</h3><p className="keywords">{item.ai.searchKeywords.join(' · ')}</p></section>}
      </>}
    </div>
  </>
}
