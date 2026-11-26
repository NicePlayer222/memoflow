import MiniSearch from 'minisearch'
import type { InboxItem } from '../types/inbox'

const cjkRun = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}ー]+)/u

function tokens(text: string, includeCharacters = false): string[] {
  return text.normalize('NFKC').split(cjkRun).flatMap((part, index) => {
    if (index % 2 === 0) return part.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []
    const chars = Array.from(part)
    if (chars.length === 1) return chars
    const pairs = chars.slice(1).map((char, i) => chars[i] + char)
    // Single-character entries make the first CJK keystroke searchable too.
    return includeCharacters ? [...pairs, ...chars] : pairs
  })
}

export function buildIndex(items: InboxItem[]) {
  const start = performance.now()
  const index = new MiniSearch({
    fields: ['title', 'rawContent', 'summary', 'tags', 'searchKeywords'],
    tokenize: text => tokens(text, true),
    searchOptions: {
      tokenize: text => tokens(text),
      prefix: term => !cjkRun.test(term),
      combineWith: 'AND',
      boost: { title: 3, tags: 2, searchKeywords: 2 },
    },
  })
  index.addAll(items.map(item => ({
    id: item.id,
    title: item.title,
    rawContent: item.rawContent,
    summary: item.ai?.summary ?? '',
    tags: item.ai?.tags.join(' ') ?? '',
    searchKeywords: item.ai?.searchKeywords.join(' ') ?? '',
  })))
  performance.clearMeasures('memoflow.search-index')
  performance.measure('memoflow.search-index', { start, detail: { count: items.length } })
  return index
}

export function searchItems(index: ReturnType<typeof buildIndex>, query: string): string[] {
  const start = performance.now()
  const ids = index.search(query).map(result => String(result.id))
  performance.clearMeasures('memoflow.search-query')
  performance.measure('memoflow.search-query', { start, detail: { matches: ids.length } })
  return ids
}

export function highlightPattern(query: string): RegExp | undefined {
  const literalWords = query.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []
  const terms = [...new Set([...literalWords, ...tokens(query)])].sort((a, b) => b.length - a.length)
  // All terms contain only letters, numbers or combining marks.
  return terms.length ? new RegExp(`(${terms.join('|')})`, 'iu') : undefined
}
