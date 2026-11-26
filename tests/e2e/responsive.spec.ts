import type { Page } from '@playwright/test'
import { expect, test } from './browser'

const tag = 'FieldNotes'.repeat(16)
const title = 'WeekendReference'.repeat(20)
const host = ['observatory'.repeat(5), 'collections'.repeat(5), 'example', 'org'].join('.')
const url = `https://${host}/${'exhibition'.repeat(40)}`
const body = '原文备忘 ' + 'catalogue'.repeat(80)
const html = `<dl><dt><h3>${tag}</h3><dl><dt><a href="${url}">${title}</a></dt><dd>${body}</dd></dl></dt></dl>`

async function expectLayoutToFit(page: Page) {
  const overflow = await page.evaluate(() => {
    const selectors = ['html', '.topbar', '.records', '.detail-body', '.rail-scroll', 'dialog[open]']
    return selectors.flatMap(selector => {
      const element = document.querySelector(selector)
      if (!element || !element.clientWidth || element.scrollWidth <= element.clientWidth + 1) return []
      return [`${selector}: ${element.scrollWidth}px in ${element.clientWidth}px`]
    })
  })
  expect(overflow).toEqual([])
}

for (const width of [320, 390, 768, 1440]) {
  test(`workspace fits ${width}px through empty, error, reading and filtered views`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width < 400 ? 740 : 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '收件箱还是空的' })).toBeVisible()
    const menu = page.getByRole('button', { name: '打开导航' })
    const narrow = width < 761
    if (narrow) {
      await expect(page.getByRole('button', { name: '设置', exact: true })).toBeHidden()
      await menu.click()
    }
    await page.getByRole('button', { name: '设置', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('AI 提供方').selectOption('gemini')
    await expect(dialog.getByLabel('API 基础地址')).toBeEditable()
    await expectLayoutToFit(page)
    await dialog.getByRole('button', { name: '取消' }).click()

    await page.getByRole('button', { name: '导入', exact: true }).click()
    const file = dialog.getByLabel('导入书签文件')
    await file.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('[{') })
    await expect(dialog.getByRole('alert')).toContainText('导入失败')
    await expectLayoutToFit(page)
    await file.setInputFiles({ name: 'long.html', mimeType: 'text/html', buffer: Buffer.from(html) })
    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId('queue-status')).toContainText('就绪 1')
    const row = page.getByTestId('inbox-row')
    await expect(row).toContainText(title)
    await row.click()
    const detail = page.getByRole('region', { name: '详情', exact: true })
    await expect(detail.getByTestId('detail-title')).toHaveText(title)
    await expect(detail.getByRole('link')).toHaveAttribute('href', url)
    await expect(detail.locator('.original')).toContainText(body)
    await expect(detail.locator('.tags')).toContainText(tag)
    await expectLayoutToFit(page)
    if (width === 390 || width === 1440) {
      await testInfo.attach('workspace-' + width, { body: await page.screenshot(), contentType: 'image/png' })
    }

    if (narrow) {
      await detail.getByRole('button', { name: '关闭详情' }).click()
      await expect(detail).toBeHidden()
      await expect(row).toBeInViewport()
      await menu.click()
    } else {
      await expect(row).toBeInViewport()
      await expect(detail).toBeInViewport()
    }
    await page.getByRole('button', { name: '标签管理', exact: true }).click()
    await expectLayoutToFit(page)
    await dialog.getByRole('button', { name: `筛选 ${tag}`, exact: true }).click()
    await expect(page.getByRole('heading', { name: tag, exact: true })).toBeVisible()
    await expectLayoutToFit(page)
    await expect(page.getByRole('button', { name: '导入', exact: true })).toBeInViewport()
  })
}
