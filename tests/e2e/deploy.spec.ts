import { expect, test } from './browser'

test.use({ baseURL: 'http://127.0.0.1:4180' })

test('loads the built app, favicon and on-demand export module under a nested mount', async ({ page, request }) => {
  const mount = '/projects/memoflow/'
  const paths: string[] = []
  const failures: string[] = []
  page.on('request', req => {
    if (req.url().startsWith('http:')) paths.push(new URL(req.url()).pathname)
  })
  page.on('response', response => {
    if (response.status() >= 400) failures.push(response.url())
  })

  await page.goto(mount)
  const icon = await page.locator('link[rel="icon"]').evaluate((el: HTMLLinkElement) => el.href)
  expect(new URL(icon).pathname).toBe(mount + 'favicon.svg')
  const response = await request.get(icon)
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/svg+xml')
  await page.getByRole('button', { name: '导入', exact: true }).click()
  await page.getByRole('button', { name: '加载演示数据' }).click()
  await expect(page.getByTestId('queue-status')).toContainText('就绪 20')

  await page.getByRole('button', { name: '导出与备份' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: '导出 Obsidian ZIP' }).click(),
  ])
  expect(await download.failure()).toBeNull()
  expect(paths.some(path => path.endsWith('.js'))).toBe(true)
  expect(paths.some(path => path.endsWith('.css'))).toBe(true)
  expect(paths.filter(path => !path.startsWith(mount))).toEqual([])
  expect(failures).toEqual([])
})
