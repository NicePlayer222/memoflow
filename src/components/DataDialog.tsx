import { useRef, useState } from 'react'
import { Archive, Download, FileJson, FileText, Trash2, Upload } from 'lucide-react'
import { withIdleQueue } from '../ai/runtime'
import { db } from '../db'
import { clearInbox, makeBackup, restoreBackup } from '../export/backupJson'
import { Dialog } from './Dialog'

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function DataDialog({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<'clear' | File | null>(null)
  const file = useRef<HTMLInputElement>(null)
  async function run(action: () => Promise<string>) {
    setBusy(true)
    setError('')
    try { notify(await withIdleQueue(action)); setConfirm(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  function save(kind: 'md' | 'zip' | 'json') {
    void run(async () => {
      const items = await db.listItems()
      const name = `memoflow-${new Date().toISOString().slice(0, 10)}.${kind}`
      if (kind === 'json') download(name, makeBackup(items), 'application/json')
      else {
        const { exportMarkdown, exportObsidianZip } = await import('../export/markdown')
        if (kind === 'md') download(name, exportMarkdown(items), 'text/markdown;charset=utf-8')
        else download(name, exportObsidianZip(items), 'application/zip')
      }
      return `已导出 ${items.length} 条记录。`
    })
  }
  return <Dialog title="导出与备份" onClose={() => { if (!busy) onClose() }}>
    <fieldset className="data-tools" disabled={busy}>
      <h3>导出全部条目</h3>
      <div className="tool-grid">
        <button className="mf-action" onClick={() => save('md')}><FileText size={15}/>导出 Markdown</button>
        <button className="mf-action" onClick={() => save('zip')}><Archive size={15}/>导出 Obsidian ZIP</button>
      </div>
      <h3>数据库备份</h3>
      <p className="mf-hint">JSON 包含全部条目、整理结果和状态。API 密钥与浏览器设置保留在本机。</p>
      <div className="tool-grid">
        <button className="mf-action" onClick={() => save('json')}><FileJson size={15}/>导出全量 JSON</button>
        <button className="mf-action" onClick={() => file.current?.click()}><Upload size={15}/>恢复 JSON</button>
        <input type="file" hidden ref={file} accept="application/json,.json" aria-label="选择 JSON 备份"
          onChange={event => { const selected = event.target.files?.[0]; if (selected) { setConfirm(selected); setError('') }; event.target.value = '' }}/>
      </div>
      <button className="danger-button" onClick={() => { setConfirm('clear'); setError('') }}><Trash2 size={14}/>清空数据库</button>
      {confirm && <div className="confirm-box"><p>{confirm === 'clear' ? '清空后只能从备份恢复。确定删除所有条目？' : `使用「${confirm.name}」替换当前全部条目？`}</p>
        <div className="tool-grid"><button className="mf-action mf-confirm" onClick={() => void run(async () => {
          if (confirm === 'clear') { await clearInbox(db); return '数据库已清空。' }
          const count = await restoreBackup(db, await confirm.text())
          return `已恢复 ${count} 条记录。`
        })}>{confirm === 'clear' ? <Trash2 size={14}/> : <Download size={14}/>} {confirm === 'clear' ? '确认清空' : '确认恢复'}</button>
          <button className="mf-action" onClick={() => setConfirm(null)}>取消</button></div>
      </div>}
    </fieldset>
    {busy && <p role="status" className="mf-hint">正在等待队列并处理数据…</p>}
    {error && <p role="alert" className="mf-form-error">{error}</p>}
  </Dialog>
}
