import { MockProvider, OpenAICompatProvider } from './provider'

export const PRESETS = {
  mock: { label: 'Mock (演示引擎)', baseUrl: '', model: 'mock' },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  gemini: { label: 'Gemini (OpenAI 兼容)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  ollama: { label: 'Ollama (本地)', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b' },
} as const

export type PresetId = keyof typeof PRESETS

export interface Settings {
  preset: PresetId
  baseUrl: string
  model: string
  apiKey: string
  concurrency: number
}

export const settingsKey = 'memoflow.settings.v1'

export function defaultsFor(preset: PresetId): Settings {
  const { baseUrl, model } = PRESETS[preset]
  return { preset, baseUrl, model, apiKey: '', concurrency: 2 }
}

function validate(value: unknown): Settings {
  if (!value || typeof value !== 'object') throw new Error('设置格式无效')
  const fields = value as Partial<Record<keyof Settings, unknown>>
  if (typeof fields.preset !== 'string' || !Object.hasOwn(PRESETS, fields.preset)) {
    throw new Error('请选择有效的提供方')
  }
  const preset = fields.preset as PresetId
  const concurrency = fields.concurrency
  if (typeof concurrency !== 'number' || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5) {
    throw new Error('并发数必须是 1 至 5 的整数')
  }
  if (preset === 'mock') return { ...defaultsFor('mock'), concurrency }
  if (typeof fields.model !== 'string' || !fields.model.trim()) throw new Error('请填写模型名称')
  if (typeof fields.apiKey !== 'string') throw new Error('密钥格式无效')
  if (typeof fields.baseUrl !== 'string' || !URL.canParse(fields.baseUrl)) throw new Error('端点地址无效')
  const endpoint = new URL(fields.baseUrl)
  const host = endpoint.hostname
  const loopback = host === 'localhost' || host === '[::1]' || /^127(?:\.\d+){3}$/.test(host)
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && loopback)) {
    throw new Error('远端地址需要 HTTPS，本机回环地址可使用 HTTP')
  }
  if (endpoint.username || endpoint.password || /[?#]/.test(endpoint.href)) {
    throw new Error('端点地址不可包含凭据、查询参数或片段')
  }
  return { preset, baseUrl: endpoint.href.replace(/\/+$/, ''), model: fields.model.trim(), apiKey: fields.apiKey.trim(), concurrency }
}

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(settingsKey)
    if (stored) return validate(JSON.parse(stored))
  } catch {
    // A fresh browser profile or an unreadable previous save can still use Mock.
  }
  return defaultsFor('mock')
}

function settingsForUse(input: Settings): Settings {
  const settings = validate(input)
  if (settings.apiKey) {
    const previous = loadSettings()
    if (previous.apiKey === settings.apiKey && (previous.preset !== settings.preset
      || new URL(previous.baseUrl).origin !== new URL(settings.baseUrl).origin)) {
      settings.apiKey = ''
    }
  }
  return settings
}

export function saveSettings(input: Settings): Settings {
  const settings = settingsForUse(input)
  localStorage.setItem(settingsKey, JSON.stringify(settings))
  return settings
}

export function providerFor(input: Settings) {
  const settings = settingsForUse(input)
  return settings.preset === 'mock' ? new MockProvider() : new OpenAICompatProvider(settings)
}
