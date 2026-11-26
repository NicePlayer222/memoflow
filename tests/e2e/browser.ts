import { expect, test as base } from '@playwright/test'

export const test = base.extend({
  page: async ({ page, baseURL, context }, use) => {
    const issues: string[] = []
    page.on('console', message => {
      if (message.type() === 'error') issues.push(message.text())
    })
    page.on('pageerror', error => issues.push(error.message))
    await context.route(/^https?:\/\//, route => {
      const url = new URL(route.request().url())
      if (url.origin === baseURL) return route.continue()
      issues.push(`Unexpected network request: ${url.origin}${url.pathname}`)
      return route.abort()
    })
    await use(page)
    expect(issues, 'browser errors or external traffic').toEqual([])
  },
})
export { expect }
