import { useEffect, useMemo, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { ArrowDownToLine, FileText, Search, Settings } from 'lucide-react'
import { type buildIndex, highlightPattern, searchItems } from '../search'
import type { InboxItem } from '../types/inbox'
import { Dialog } from './Dialog'
import '../search/search.css'

interface Props {
  items: InboxItem[]
  index: ReturnType<typeof buildIndex>
  onSelect: (id: string) => void
  onClose: () => void
  onImport: () => void
  onSettings: () => void
}

function highlighted(value: string, pattern?: RegExp) {
  if (!pattern) return value
  return value.split(pattern).map((part, i) => i % 2 ? <mark key={i}>{part}</mark> : part)
}

function excerpt(item: InboxItem, pattern?: RegExp) {
  const fields = [item.ai?.summary, item.rawContent, item.ai?.tags.join(' · '), item.ai?.searchKeywords.join(' · ')]
  const text = (pattern && fields.find(field => field && pattern.test(field))) || fields.find(Boolean) || ''
  const at = pattern ? Math.max(0, text.search(pattern)) : 0
  const start = Math.max(0, at - 25)
  return (start ? '…' : '') + text.slice(start, start + 120) + (start + 120 < text.length ? '…' : '')
}

export function SearchDialog({ items, index, onSelect, onClose, onImport, onSettings }: Props) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(50)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  const byId = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
  const term = query.trim().toLowerCase()
  const results = useMemo(() => term ? searchItems(index, term).flatMap(id => byId.get(id) ?? [])
    : items.slice(0, 10), [index, term, items, byId])
  const pattern = useMemo(() => highlightPattern(term), [term])
  const commands = [
    { name: '导入条目', keywords: '导入条目 import', run: onImport, icon: ArrowDownToLine },
    { name: '设置', keywords: '设置 settings', run: onSettings, icon: Settings },
  ].filter(action => action.keywords.includes(term))

  return <Dialog title="搜索" onClose={onClose}>
    <Command className="inbox-search" label="搜索条目或命令" shouldFilter={false}>
      <div className="search-input-row">
        <Search size={18} aria-hidden="true" />
        <Command.Input ref={input} value={query} onValueChange={value => { setQuery(value); setLimit(50) }}
          placeholder="搜索条目或命令…" />
      </div>
      <Command.List label="搜索结果">
        {!commands.length && !results.length && <p role="status">没有匹配的条目或命令</p>}
        {commands.length > 0 && <Command.Group heading="命令">
          {commands.map(({ name, run, icon: Icon }) => <Command.Item key={name} value={name}
            onSelect={() => { onClose(); run() }}>
            <Icon size={16} aria-hidden="true" />{name}
          </Command.Item>)}
        </Command.Group>}
        {results.length > 0 && <Command.Group heading={term ? `条目 · ${results.length}` : '最近条目'}>
          {results.slice(0, limit).map(item => <Command.Item key={item.id} value={item.id}
            onSelect={() => { onClose(); onSelect(item.id) }}>
            <FileText size={16} aria-hidden="true" />
            <span className="search-hit">
              <strong>{highlighted(item.title || '无标题', pattern)}</strong>
              <small>{highlighted(excerpt(item, pattern), pattern)}</small>
            </span>
          </Command.Item>)}
        </Command.Group>}
        {results.length > limit && <Command.Item value="more-results" onSelect={() => setLimit(limit + 50)}>
          显示更多结果（已显示 {limit} / {results.length}）
        </Command.Item>}
      </Command.List>
    </Command>
  </Dialog>
}

export default SearchDialog
