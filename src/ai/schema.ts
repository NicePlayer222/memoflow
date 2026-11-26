import type { InboxItem } from '../types/inbox'

export type Analysis = NonNullable<InboxItem['ai']>
type AnalysisFields = Omit<Analysis, 'processedAt' | 'model'>

export const categories = ['人工智能', '软件开发', '设计与研究', '艺术与文化', '阅读与写作', '城市与自然', '生活记录'] as const
const fields: (keyof AnalysisFields)[] = ['summary', 'category', 'tags', 'takeaways', 'searchKeywords']

function strings(value: unknown, name: string, min: number, max: number): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max ||
      !value.every((entry): entry is string => typeof entry === 'string' && !!entry.trim())) {
    throw new Error(`${name} 需要 ${min}–${max} 个非空字符串。`)
  }
  return value.map(entry => entry.trim())
}

export function validateAnalysis(value: unknown, minTags: 1 | 2 = 2): AnalysisFields {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AI 结果应为 JSON 对象。')
  const data = value as Record<string, unknown>
  if (Object.keys(data).some(key => !fields.some(field => key === field))) throw new Error('AI 结果含未定义的字段。')
  if (typeof data.summary !== 'string' || !data.summary.trim() || [...data.summary.trim()].length > 120) {
    throw new Error('summary 需要 1–120 个字符。')
  }
  const category = categories.find(name => name === data.category)
  if (!category) throw new Error('category 不在预设分类中。')
  return {
    summary: data.summary.trim(), category,
    tags: strings(data.tags, 'tags', minTags, 5),
    takeaways: strings(data.takeaways, 'takeaways', 1, 3),
    searchKeywords: strings(data.searchKeywords, 'searchKeywords', 3, 8),
  }
}

export function parseAnalysis(text: string): AnalysisFields {
  const json = text.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(json)
  return validateAnalysis(JSON.parse(fenced?.[1] ?? json))
}
