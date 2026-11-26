import type { InboxItem, ProviderConfig } from '../types/inbox'
import { analysisMessages } from './prompt'
import { categories, parseAnalysis, type Analysis } from './schema'

export interface AIProvider {
  analyze(item: InboxItem, signal?: AbortSignal): Promise<Analysis>
}

export class ProviderHttpError extends Error {
  constructor(public readonly status: number, message = `AI 服务返回 HTTP ${status}。`) {
    super(message)
    this.name = 'ProviderHttpError'
  }
}

export class OpenAICompatProvider implements AIProvider {
  constructor(private readonly config: ProviderConfig) {}

  async analyze(item: InboxItem, signal?: AbortSignal): Promise<Analysis> {
    const base = new URL(this.config.baseUrl.trim())
    if (!['http:', 'https:'].includes(base.protocol) || base.search || base.hash || base.username || base.password) {
      throw new Error('请填写 HTTP(S) API 基础地址。')
    }
    const model = this.config.model.trim()
    if (!model) throw new Error('请填写模型名称。')
    base.pathname = base.pathname.replace(/\/+$/, '') + '/chat/completions'
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const key = this.config.apiKey?.trim()
    if (key) headers.Authorization = `Bearer ${key}`
    const response = await fetch(base.href, {
      method: 'POST', headers, redirect: 'error', credentials: 'omit',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
      body: JSON.stringify({ model, messages: analysisMessages(item) }),
    })
    if (!response.ok) throw new ProviderHttpError(response.status)
    const result = await response.json()
    const content = result?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new Error('AI 响应缺少分析内容。')
    return { ...parseAnalysis(content), model, processedAt: new Date().toISOString() }
  }
}

type Topic = { category: typeof categories[number]; match: RegExp; terms: [string, string, string] }

const topics: Topic[] = [
  { category: '人工智能', match: /人工智能|大模型|机器学习|\b(ai|llms?|embeddings?|machine learning|neural networks?)\b/i, terms: ['人工智能', 'AI', '机器学习'] },
  { category: '软件开发', match: /dexie|数据库|indexeddb|\b(sqlite|react|unix|css|javascript|typescript|coding)\b|编程/i, terms: ['开发', 'software', '编程'] },
  { category: '设计与研究', match: /设计|排版|访谈|可用性|typography|prototype|interface|chart|observable plot|pattern language/i, terms: ['设计', 'design', '研究'] },
  { category: '艺术与文化', match: /录音|混音|播客|文物|艺术|照片|recording|room tone|listening walk|botanical plates|exhibition/i, terms: ['文化', 'arts', '创作'] },
  { category: '阅读与写作', match: /阅读|读书|写作|章节|reading|books?|writing/i, terms: ['阅读', 'reading', '写作'] },
  { category: '城市与自然', match: /城市|行走|散步|步行|地图|河流|urban|walk|landscape/i, terms: ['城市', 'urban', '自然'] },
]

const concepts: [RegExp, string, string][] = [
  [/dexie|indexeddb|local.first|离线/i, '离线存储', 'IndexedDB'],
  [/sqlite|query plan|查询计划/i, '查询计划', 'SQLite'],
  [/react|selectedId/i, '状态管理', 'React'],
  [/grid|网格/i, '网格布局', 'CSS Grid'],
  [/排版|标点|typograph/i, '排版', 'typography'],
  [/访谈|可用性|prototype|interface/i, '用户研究', 'user research'],
  [/大模型|\bllms?\b|language model/i, '大语言模型', 'LLM'],
  [/embeddings?|向量检索/i, '向量检索', 'embedding'],
  [/录音|混音|播客|room tone|field recording/i, '声音采集', 'field recording'],
  [/地图|底图|openstreetmap/i, '地图', 'mapping'],
]

const sourceLabels = {
  manual: ['手记', 'Note'], markdown: ['摘录', 'Excerpt'],
  browser: ['书签', 'Bookmark'], x: ['推文', 'Post'],
} as const

export class MockProvider implements AIProvider {
  constructor(private readonly delayMs = 150) {}

  async analyze(item: InboxItem, signal?: AbortSignal): Promise<Analysis> {
    signal?.throwIfAborted()
    if (this.delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          signal?.removeEventListener('abort', cancel)
          resolve()
        }, this.delayMs)
        function cancel() {
          clearTimeout(timer)
          reject(signal?.reason)
        }
        signal?.addEventListener('abort', cancel, { once: true })
      })
    }
    const text = [item.title, item.rawContent, ...(item.folderPath ?? []), item.url].join(' ')
    const topic = topics.find(topic => topic.match.test(text))
    const category = topic?.category ?? '生活记录'
    const terms = topic?.terms ?? ['生活', 'everyday', '笔记']
    const primaryTag = category === '人工智能' && !/人工智能|大模型|机器学习/.test(text) ? 'AI' : terms[0]
    const detail = item.rawContent.trim() || item.title.trim() || item.url || '未命名条目'
    const sentences = detail.split(/(?<=[。！？!?])\s*|(?<=\.)\s+|\n+/u).map(sentence => sentence.trim()).filter(Boolean)
    // Prefer a concrete observation or next action to introductory prose.
    const highlight = sentences.find(sentence => /下次|发现|观察|下轮|先试|\b(try|check|compare|ask|save|trace)\b/i.test(sentence)) ?? sentences[0]!
    const [zh, en] = sourceLabels[item.source]
    const chinese = /\p{Script=Han}/u.test(item.title + detail)
    const label = chinese ? zh : en
    const title = item.title.trim()
    const excerpt = [...`${label} · ${title && title !== highlight ? title + ' — ' : ''}${highlight}`.replace(/\s+/gu, ' ')]
    const specific = concepts.filter(([match]) => match.test(text)).flatMap(([, zhTerm, enTerm]) => [zhTerm, enTerm])
    const folders = item.folderPath?.map(folder => folder.trim()).filter(Boolean) ?? []
    return {
      summary: excerpt.length <= 120 ? excerpt.join('') : excerpt.slice(0, 119).join('') + '…',
      category,
      tags: [...new Set([primaryTag, ...specific.slice(0, 1), ...folders.slice(-1), label, terms[2]])].slice(0, 5),
      takeaways: sentences.slice(0, 2),
      searchKeywords: [...new Set([...specific, ...terms, ...folders, title].filter(Boolean))].slice(0, 8),
      processedAt: new Date().toISOString(), model: 'mock-local',
    }
  }
}
