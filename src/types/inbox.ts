export type Source = 'x' | 'browser' | 'markdown' | 'manual'
export type Status = 'pending' | 'processing' | 'ready' | 'failed' | 'archived'

export interface InboxDraft {
  source: Source
  url?: string
  title: string
  rawContent: string
  author?: string
  createdAt?: string
  folderPath?: string[]
}

export interface InboxItem extends InboxDraft {
  id: string
  canonicalUrl?: string
  createdAt: string
  importedAt: string
  status: Status
  errorMessage?: string
  fingerprint: string
  ai?: {
    summary: string
    category: string
    tags: string[]
    takeaways: string[]
    searchKeywords: string[]
    processedAt: string
    model: string
  }
}

export interface QueueJob {
  itemId: string
  attempts: number
}

export interface ProviderConfig {
  baseUrl: string
  model: string
  apiKey?: string
}
