// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { MockProvider, OpenAICompatProvider } from '../../src/ai/provider'
import { defaultsFor, loadSettings, PRESETS, providerFor, saveSettings } from '../../src/ai/settings'

beforeEach(() => localStorage.clear())

describe('provider settings', () => {
  it('starts in keyless Mock mode and provides the configured compat presets', () => {
    expect(loadSettings()).toEqual({ preset: 'mock', baseUrl: '', model: 'mock', apiKey: '', concurrency: 2 })
    expect(providerFor(loadSettings())).toBeInstanceOf(MockProvider)
    expect(Object.keys(PRESETS)).toEqual(['mock', 'deepseek', 'gemini', 'openai', 'ollama'])
    expect(defaultsFor('deepseek')).toMatchObject({ baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' })
    expect(defaultsFor('gemini')).toMatchObject({ baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' })
    expect(defaultsFor('openai')).toMatchObject({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' })
    expect(defaultsFor('ollama')).toMatchObject({ baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b' })
    expect(providerFor(defaultsFor('ollama'))).toBeInstanceOf(OpenAICompatProvider)
  })

  it('round-trips local settings and normalizes harmless input whitespace', () => {
    const input = { ...defaultsFor('openai'), apiKey: ' local-test-value ', baseUrl: 'https://example.org/v1/', model: ' small ', concurrency: 5 }
    expect(saveSettings(input)).toMatchObject({ baseUrl: 'https://example.org/v1', model: 'small', apiKey: 'local-test-value' })
    expect(loadSettings()).toEqual({ ...input, baseUrl: 'https://example.org/v1', model: 'small', apiKey: 'local-test-value' })
  })

  it('discards an unchanged key after switching origin or provider and removes the old saved value', () => {
    const previous = saveSettings({ ...defaultsFor('openai'), apiKey: 'test-old' })
    expect(saveSettings({ ...previous, baseUrl: 'https://other.example/v1' }).apiKey).toBe('')
    saveSettings(previous)
    expect(saveSettings({ ...defaultsFor('gemini'), apiKey: previous.apiKey }).apiKey).toBe('')
    expect(localStorage.getItem(localStorage.key(0)!)).not.toContain('test-old')
    expect(saveSettings({ ...defaultsFor('gemini'), apiKey: 'test-new' }).apiKey).toBe('test-new')
  })

  it('never stores a key for Mock, even when a form includes it', () => {
    saveSettings({ ...defaultsFor('mock'), apiKey: 'test-value' })
    expect(loadSettings().apiKey).toBe('')
    expect(localStorage.getItem(localStorage.key(0)!)).not.toContain('test-value')
  })

  it.each([
    'http://public.example/v1', 'http://127.private.example', 'http://localhost.example',
    'file:///tmp/model', 'https://alice:example@example.org/v1', 'https://example.org/v1?token=example',
  ])('rejects an unsafe endpoint before replacing saved settings (%s)', baseUrl => {
    expect(() => saveSettings({ ...defaultsFor('openai'), baseUrl })).toThrow()
    expect(loadSettings().preset).toBe('mock')
  })

  it.each(['http://127.0.0.1:11434/v1', 'http://[::1]:11434/v1'])('permits local HTTP at %s', baseUrl => {
    expect(saveSettings({ ...defaultsFor('ollama'), baseUrl }).baseUrl).toBe(baseUrl)
  })

  it.each([0, 6, 1.5])('rejects invalid concurrency %s', concurrency => {
    expect(() => saveSettings({ ...defaultsFor('mock'), concurrency })).toThrow('并发数')
  })

  it.each(['{broken', 'null', '{"preset":"__proto__"}'])('recovers from unreadable or unknown stored settings', corrupted => {
    saveSettings(defaultsFor('openai'))
    localStorage.setItem(localStorage.key(0)!, corrupted)
    expect(loadSettings()).toEqual(defaultsFor('mock'))
  })
})
