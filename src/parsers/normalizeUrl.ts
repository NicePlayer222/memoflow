/** Canonical identity for HTTP(S) bookmarks. Keep fragments for deep links. */
export function normalizeUrl(input: string): string | undefined {
  const value = input.trim()
  if (!/^https?:\/\//i.test(value)) return undefined

  try {
    const url = new URL(value)
    const retained = new URLSearchParams()
    for (const [key, val] of url.searchParams) {
      if (!/^(utm_.*|fbclid|ref|s|t)$/i.test(key)) retained.append(key, val)
    }
    retained.sort()
    url.search = ''
    const fragment = url.hash
    url.hash = ''
    const query = retained.toString()
    return url.href.replace(/\/+$/, '') + (query ? '?' + query : '') + fragment
  } catch {
    return undefined
  }
}
