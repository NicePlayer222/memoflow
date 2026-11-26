import { marked, type Token } from 'marked'
import type { InboxDraft } from '../types/inbox'
import { normalizeUrl } from './normalizeUrl'

export function parseMarkdownLinks(text: string): InboxDraft[] {
  const drafts: InboxDraft[] = []
  const blocks = marked.lexer(text, { gfm: true, breaks: true })

  function collectLines(tokens: Token[]) {
    let start = 0
    for (let end = 0; end <= tokens.length; end++) {
      if (end < tokens.length && tokens[end]?.type !== 'br') continue
      const line = tokens.slice(start, end)
      start = end + 1
      const rawContent = line.map(token => token.raw).join('').trim()
      marked.walkTokens(line, token => {
        if (token.type !== 'link') return
        const bare = token.autolink && !token.raw.startsWith('<')
        const url = bare ? token.href.replace(/[。，、；：！？）》】」』”’]+$/u, '') : token.href
        if (!normalizeUrl(url)) return
        const title = token.autolink ? url : token.text.trim() || url
        drafts.push({ source: 'markdown', title, rawContent, url })
      })
    }
  }

  marked.walkTokens(blocks, block => {
    if ((block.type === 'paragraph' || block.type === 'heading' || block.type === 'text') && block.tokens) {
      collectLines(block.tokens)
    } else if (block.type === 'table') {
      for (const cell of [...block.header, ...block.rows.flat()]) collectLines(cell.tokens)
    }
  })
  return drafts
}
