import { useMemo, useState } from 'react'
import { Hash } from 'lucide-react'
import type { InboxItem } from '../types/inbox'
import { db } from '../db'
import { renameTag, tagCounts } from '../db/tags'
import { Dialog } from './Dialog'

interface Props {
  items: InboxItem[]
  onClose: () => void
  notify: (message: string) => void
  onFilter: (tag: string) => void
}

export function TagsDialog({ items, onClose, notify, onFilter }: Props) {
  const counts = useMemo(() => [...tagCounts(items)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), [items])
  const [chosen, choose] = useState('')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const source = counts.some(([tag]) => tag === chosen) ? chosen : counts[0]?.[0] ?? ''

  async function save() {
    setBusy(true); setError('')
    try {
      const updated = await renameTag(db, source, target)
      choose(target.trim()); setTarget('')
      notify(`已更新 ${updated} 条记录的标签。`)
    } catch (cause) { setError(String(cause)) }
    finally { setBusy(false) }
  }
  return <Dialog title="标签管理" onClose={onClose}>
    {!counts.length ? <p className="mf-hint">整理条目后，可以在这里查看和合并标签。</p> : <>
      <div className="tag-choices">{counts.map(([name, count]) => <button className="mf-action" key={name} aria-label={`筛选 ${name}`}
        onClick={() => onFilter(name)}><Hash size={13}/>{name}<small>{count}</small></button>)}</div>
      <form onSubmit={e => { e.preventDefault(); void save() }}>
        <label className="mf-field">原标签<select value={source} onChange={e => choose(e.target.value)}>
          {counts.map(([name, count]) => <option value={name} key={name}>{name} ({count})</option>)}</select></label>
        <label className="mf-field">新标签名称<input value={target} list="existing-tags" onChange={e => setTarget(e.target.value)} required /></label>
        <datalist id="existing-tags">{counts.filter(([name]) => name !== source).map(([name]) => <option key={name} value={name}/>)}</datalist>
        <p className="mf-hint">{counts.some(([name]) => name === target.trim() && name !== source)
          ? `将「${source}」合并进「${target.trim()}」，重复标签会自动移除。` : '输入新名称可重命名，选择已有名称可合并。'}</p>
        {error && <p role="alert">{error}</p>}
        <button className="mf-action mf-confirm" disabled={busy || !target.trim() || source === target.trim()}>保存标签</button>
      </form>
    </>}
  </Dialog>
}
