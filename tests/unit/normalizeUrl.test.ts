import { describe, expect, it } from 'vitest'
import { normalizeUrl } from '../../src/parsers/normalizeUrl'

describe('normalizeUrl', () => {
  it('removes tracking keys regardless of case and strips the trailing slash before query and fragment', () => {
    expect(normalizeUrl(' HTTPS://Example.COM:443/Docs///?UTM_source=a&s=1&b=2&ref=me&t=3&fbclid=x&A=4#Intro '))
      .toBe('https://example.com/Docs?A=4&b=2#Intro')
  })

  it('preserves ports, repeated query values, non-tracking keys and anchor identity', () => {
    const url = 'http://example.com:8080?q=first&q=second&referrer=home#toc'
    expect(normalizeUrl(url)).toBe(url)
    expect(normalizeUrl('https://Example.org/?utm_medium=x')).toBe('https://example.org')
  })

  it.each(['', '/relative', 'javascript:alert(1)', 'https://', 'https://bad host'])(
    'rejects unsupported or invalid URL %j', url => expect(normalizeUrl(url)).toBeUndefined(),
  )
})
