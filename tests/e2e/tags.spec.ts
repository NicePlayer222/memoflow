import { expect, test } from './browser'

test('renaming and merging update counts, search and tag-filtered records without reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '导入', exact: true }).click()
  await page.getByLabel('导入书签文件').setInputFiles({
    name: 'bookmarks.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([
      { title: 'Lake notes', text: 'A sketch of an AI workflow.' },
      { title: '云端笔记', text: '人工智能工具的选择。' },
    ])),
  })
  await expect(page.getByTestId('queue-status')).toContainText('就绪 2')
  const openTags = page.getByRole('button', { name: '标签管理', exact: true })
  const dialog = page.getByRole('dialog')
  const option = (tag: string) => dialog.getByRole('button', { name: `筛选 ${tag}`, exact: true })
  async function change(from: string, to: string) {
    await dialog.getByLabel('原标签').selectOption(from)
    await dialog.getByLabel('新标签名称').fill(to)
    await dialog.getByRole('button', { name: '保存标签' }).click()
    await expect(option(from)).toHaveCount(0)
  }
  await openTags.click()
  await change('AI', 'cedaratlas')
  await expect(option('cedaratlas')).toContainText('1')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+k')
  await dialog.getByRole('combobox').fill('cedaratlas')
  await expect(dialog.getByRole('option')).toHaveCount(1)
  await expect(dialog.getByRole('option')).toContainText('Lake notes')
  await page.keyboard.press('Escape')

  await openTags.click()
  await change('cedaratlas', '人工智能')
  await expect(option('人工智能')).toContainText('2')
  await option('人工智能').click()
  await expect(page.getByRole('heading', { name: '人工智能', exact: true })).toBeVisible()
  await expect(page.getByTestId('inbox-row')).toHaveCount(2)
  await page.keyboard.press('Control+k')
  const search = dialog.getByRole('combobox')
  await search.fill('cedaratlas')
  await expect(dialog.getByText('没有匹配的条目或命令')).toBeVisible()
  await search.fill('人工智能')
  await expect(dialog.getByRole('option')).toHaveCount(2)
})
