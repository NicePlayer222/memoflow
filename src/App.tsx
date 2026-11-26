import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, BookOpen, CheckCircle2, ChevronDown, CircleAlert, Clock3, FileText, Folder, Globe, Hash, Inbox, Layers, Menu, Moon, Pause, PenLine, Play, Plus, RotateCcw, Search, Settings2, Sun, X } from 'lucide-react'
import { db } from './db'
import { retryFailed, setPaused, useQueueState } from './ai/runtime'
import { buildIndex } from './search'
import { DetailPane } from './components/DetailPane'
import { SettingsDialog } from './components/SettingsDialog'
import { TagsDialog } from './components/TagsDialog'
import { DataDialog } from './components/DataDialog'
import type { InboxItem, Status } from './types/inbox'

const ImportDialog = lazy(() => import('./components/ImportDialog').then(module => ({ default: module.ImportDialog })))
const SearchDialog = lazy(() => import('./components/SearchDialog'))
const pageSize = 60

const views = [
  { id: 'all', label: '全部', icon: Inbox }, { id: 'pending', label: '待处理', icon: Clock3 },
  { id: 'ready', label: '已就绪', icon: CheckCircle2 }, { id: 'failed', label: '失败', icon: CircleAlert },
  { id: 'archived', label: '已归档', icon: Archive },
] as const
type View = typeof views[number]['id']
type Modal = 'import' | 'settings' | 'search' | 'tags' | 'data' | null
const sources = { browser: ['浏览器书签', Globe], markdown: ['Markdown', FileText], x: ['X 书签', BookOpen], manual: ['手记', PenLine] } as const
const statuses: Record<Status, string> = { pending: '待处理', processing: '整理中', ready: '已就绪', failed: '失败', archived: '已归档' }
const emptyItems: InboxItem[] = []

export default function App() {
  const [modal, setModal] = useState<Modal>(null)
  const [view, setView] = useState<View>('all')
  const [facet, setFacet] = useState<{ type: 'category' | 'tag'; name: string } | null>(null)
  const [selectedId, setSelected] = useState('')
  const [mobileDetail, showDetail] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [message, notify] = useState('')
  const [readAttempt, retryRead] = useState(0)
  const records = useRef<HTMLDivElement>(null)
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('memoflow.theme')
      if (saved === 'dark' || saved === 'light') return saved === 'dark'
    } catch { /* Use system appearance when preferences are unavailable. */ }
    return matchMedia('(prefers-color-scheme: dark)').matches
  })
  const queue = useQueueState()
  const result = useLiveQuery(async () => {
    try { return { items: await db.listItems(), error: '' } }
    catch (error) { return { items: emptyItems, error: String(error) } }
  }, [readAttempt])
  const items = result?.items ?? emptyItems
  const getIndex = useMemo(() => {
    let cached: ReturnType<typeof buildIndex> | undefined
    return () => cached ??= buildIndex(items)
  }, [items])
  const counts = useMemo(() => {
    const status = { all: items.length, pending: 0, processing: 0, ready: 0, failed: 0, archived: 0 }
    const categories = new Set<string>(), tags = new Set<string>()
    for (const item of items) {
      status[item.status]++
      if (item.ai) {
        categories.add(item.ai.category)
        item.ai.tags.forEach(tag => tags.add(tag))
      }
    }
    return { status, categories: [...categories].sort(), tags: [...tags].sort() }
  }, [items])
  const visible = useMemo(() => items.filter(item => {
    if (view !== 'all' && item.status !== view && !(view === 'pending' && item.status === 'processing')) return false
    if (facet?.type === 'category') return item.ai?.category === facet.name
    if (facet?.type === 'tag') return item.ai?.tags.includes(facet.name)
    return true
  }), [items, view, facet])
  const currentIndex = Math.max(0, visible.findIndex(item => item.id === selectedId))
  const selected = visible[currentIndex]
  const page = Math.floor(currentIndex / pageSize)
  const pages = Math.ceil(visible.length / pageSize)
  const pageRows = visible.slice(page * pageSize, (page + 1) * pageSize)
  const heading = facet?.name ?? views.find(tab => tab.id === view)!.label
  const countFor = (id: View) => counts.status[id] + (id === 'pending' ? counts.status.processing : 0)

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])
  useEffect(() => {
    const row = records.current?.querySelector<HTMLElement>('[data-selected="true"]')
    row?.scrollIntoView({ block: 'nearest' })
  }, [selected?.id, page])

  function toggleTheme() {
    setDark(!dark)
    try { localStorage.setItem('memoflow.theme', dark ? 'light' : 'dark') }
    catch { notify('主题已切换，浏览器未允许保存偏好。') }
  }

  function select(id: string) { setSelected(id); showDetail(true) }
  function changeView(next: View, nextFacet: typeof facet = null) {
    setView(next); setFacet(nextFacet); setSelected(''); setNavOpen(false); showDetail(false)
  }
  function update(status: Status) {
    if (!selected) return
    void db.updateItem(selected.id, { status }).then(() => notify(status === 'archived' ? '已归档' : status === 'ready' ? '已移出归档' : '已加入整理队列')).catch(error => notify(String(error)))
  }
  function archive() { if (selected) update(selected.status !== 'archived' ? 'archived' : selected.ai ? 'ready' : 'pending') }
  function open(next: Modal) { setNavOpen(false); setModal(next) }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target
      if (!modal && navOpen && event.key === 'Escape') { event.preventDefault(); setNavOpen(false); return }
      if (modal || event.isComposing || (target instanceof HTMLElement && (target.isContentEditable || target.closest('input,textarea,select,[role="textbox"]')))) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); open('search'); return
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key === '/') { event.preventDefault(); open('search'); return }
      if (!selected) return
      switch (event.key) {
        case 'j':
        case 'k': {
          event.preventDefault()
          const i = Math.max(0, Math.min(visible.length - 1, currentIndex + (event.key === 'j' ? 1 : -1)))
          select(visible[i]!.id)
          break
        }
        case 'e': event.preventDefault(); archive(); break
        case 'r': event.preventDefault(); update('pending'); break
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })

  return <div className="app-shell">
    {navOpen && <button className="scrim" aria-label="关闭导航" onClick={() => setNavOpen(false)}/>}
    <aside id="workspace-navigation" className={'rail' + (navOpen ? ' open' : '')}>
      <div className="brand"><span><Layers size={19}/></span>MemoFlow</div>
      <button className="search-open" onClick={() => open('search')}><Search size={16}/>搜索碎片<kbd>⌘ / Ctrl K</kbd></button>
      <nav aria-label="收件箱视图"><h2>工作台</h2>{views.map(({ id, label, icon: Icon }) =>
        <button key={id} aria-label={label} aria-current={view === id && !facet ? 'page' : undefined} onClick={() => changeView(id)}>
          <Icon size={16}/>{label}<small>{countFor(id)}</small></button>)}</nav>
      <div className="rail-scroll">
        {(['category', 'tag'] as const).map(kind => {
          const names = kind === 'tag' ? counts.tags : counts.categories
          return names.length > 0 && <details key={kind} open={kind === 'category'}><summary>{kind === 'tag' ? '标签' : '分类'}<ChevronDown size={13}/></summary>
            {names.map(name => <button key={name} aria-current={facet?.type === kind && facet.name === name ? 'page' : undefined}
              onClick={() => changeView('all', { type: kind, name })}>
              {kind === 'tag' ? <Hash size={14}/> : <Folder size={14}/>} {name}
            </button>)}</details>
        })}
      </div>
      <div className="library-tools"><button onClick={() => open('tags')}><Hash size={16}/>标签管理</button>
        <button onClick={() => open('data')}><Archive size={16}/>导出与备份</button></div>
      <footer><button onClick={() => open('settings')} aria-label="设置"><Settings2 size={16}/>设置</button>
        <button aria-label={dark ? '切换到浅色主题' : '切换到深色主题'} onClick={toggleTheme}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button></footer>
    </aside>
    <main className="desk">
      <header className="topbar"><div className="crumb"><button className="narrow-only" aria-label="打开导航" aria-controls="workspace-navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}><Menu size={19}/></button><Inbox size={16}/> 收件箱 <span>/</span> <strong className="crumb-current" title={heading}>{heading}</strong></div>
        <button className="primary" onClick={() => open('import')} aria-label="导入"><Plus size={16}/>导入</button></header>
      <div className="columns">
        <section className="list-pane" aria-label="条目列表">
          <div className="list-header"><h1>{view === 'all' && !facet ? '全部碎片' : heading}</h1><span className="count">{visible.length}</span></div>
          <div className="queue-bar"><span className={'dot ' + (queue.paused ? 'pending' : 'ready')}/>
            <span data-testid="queue-status">{queue.paused ? '已暂停' : counts.status.processing ? '整理中' : '队列空闲'} · 就绪 {counts.status.ready}</span>
            <button aria-label={queue.paused ? '继续队列' : '暂停队列'} title={queue.paused ? '继续队列' : '暂停队列'} onClick={() => setPaused(!queue.paused)}>{queue.paused ? <Play/> : <Pause/>}</button>
            {counts.status.failed > 0 && <button title="重试全部失败项" aria-label="重试全部失败项" onClick={() => void retryFailed().catch(error => notify(String(error)))}><RotateCcw/></button>}
          </div>
          {queue.error && <p role="alert" className="error">队列出错：{queue.error}</p>}
          <div className="records" ref={records} aria-busy={!result}>
            {pageRows.map(item => {
              const [source, Icon] = sources[item.source]
              return <button key={item.id} className="record" data-testid="inbox-row" data-id={item.id}
                data-selected={selected?.id === item.id} onClick={() => select(item.id)}>
                <span className="row-meta"><Icon size={13}/>{source}<span className="row-status"><i className={'dot ' + item.status}/>{statuses[item.status]}</span></span>
                <strong>{item.title}</strong><span className="excerpt">{item.ai?.summary || item.rawContent || item.url}</span>
              </button>
            })}
            {result?.error ? <div className="empty-state" role="alert"><CircleAlert size={28}/><h3>无法读取本地收件箱</h3><p>{result.error}</p>
              <button className="outline" onClick={() => retryRead(n => n + 1)}>重新读取</button></div>
              : !visible.length && <div className="empty-state"><Inbox size={30}/><h3>{!result ? '正在读取收件箱…' : items.length ? '此视图暂无条目' : '收件箱还是空的'}</h3>
              {result && !items.length && <button className="outline" onClick={() => open('import')}><Plus size={15}/>导入第一份碎片</button>}</div>}
          </div>
          {pages > 1 && <nav className="pager" aria-label="列表分页">
            <button disabled={page === 0} onClick={() => setSelected(visible[(page - 1) * pageSize]!.id)}>上一页</button>
            <span>{page + 1} / {pages}</span>
            <button disabled={page === pages - 1} onClick={() => setSelected(visible[(page + 1) * pageSize]!.id)}>下一页</button>
          </nav>}
        </section>
        <section className={'detail-pane' + (mobileDetail && selected ? ' active' : '')} aria-label="详情">
          {selected ? <DetailPane key={selected.id} item={selected} onArchive={archive} onRequeue={() => update('pending')} onClose={() => showDetail(false)} notify={notify}/>
            : <div className="empty-state"><FileText size={28}/><p>选择条目以查看详情</p></div>}
        </section>
      </div>
    </main>
    <Suspense fallback={<div role="status" className="toast">正在打开…</div>}>
    {modal === 'import' && <ImportDialog onClose={() => open(null)} notify={notify}/>}
    {modal === 'settings' && <SettingsDialog onClose={() => open(null)} notify={notify}/>}
    {modal === 'tags' && <TagsDialog items={items} onClose={() => open(null)} notify={notify}
      onFilter={name => { changeView('all', { type: 'tag', name }); open(null) }}/>}
    {modal === 'data' && <DataDialog onClose={() => open(null)} notify={notify}/>}
    {modal === 'search' && <SearchDialog items={items} index={getIndex()} onClose={() => open(null)}
      onSelect={id => { changeView('all'); select(id); open(null) }} onImport={() => open('import')} onSettings={() => open('settings')}/>}
    </Suspense>
    {message && <div className="toast" role="status">{message}<button aria-label="关闭提示" onClick={() => notify('')}><X size={14}/></button></div>}
  </div>
}
