import { readFile } from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'
import { parse as parseYaml } from 'yaml'
import { expect, test } from './browser'

test('download all formats and restore every saved field after clearing the inbox', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '导入', exact: true }).click()
  await page.getByRole('button', { name: '加载演示数据' }).click()
  await expect(page.getByTestId('queue-status')).toContainText('就绪 20')
  await page.getByTestId('inbox-row').first().click()
  await page.keyboard.press('e')
  await expect(page.getByTestId('queue-status')).toContainText('就绪 19')
  await page.getByRole('button', { name: '导出与备份' }).click()
  const dialog = page.getByRole('dialog')
  async function getFile(label: string) {
    const [download] = await Promise.all([
      page.waitForEvent('download'), dialog.getByRole('button', { name: label, exact: true }).click(),
    ])
    return readFile((await download.path())!)
  }
  const before = await getFile('导出全量 JSON')
  const backup = JSON.parse(before.toString())
  expect(backup.items).toHaveLength(20)
  expect(backup.items[0].ai.tags.length).toBeGreaterThan(0)
  const fileInput = dialog.locator('input[type=file]')
  await fileInput.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"bad":true}') })
  await dialog.getByRole('button', { name: '确认恢复' }).click()
  await expect(dialog.getByRole('alert')).toContainText('备份')
  await expect(page.getByTestId('inbox-row')).toHaveCount(20)
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  expect((await getFile('导出 Markdown')).toString()).toContain(backup.items[0].title)
  const notes = Object.values(unzipSync(await getFile('导出 Obsidian ZIP')))
  expect(notes).toHaveLength(20)
  for (const note of notes) {
    const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(strFromU8(note))
    expect(parseYaml(front![1]!)).toMatchObject({ title: expect.any(String), tags: expect.any(Array) })
  }
  await dialog.getByRole('button', { name: '清空数据库', exact: true }).click()
  await dialog.getByRole('button', { name: '确认清空' }).click()
  await expect(page.getByTestId('inbox-row')).toHaveCount(0)
  await fileInput.setInputFiles({
    name: 'roundtrip.json', mimeType: 'application/json', buffer: before,
  })
  await dialog.getByRole('button', { name: '确认恢复' }).click()
  await expect(page.getByTestId('inbox-row')).toHaveCount(20)
  const after = JSON.parse((await getFile('导出全量 JSON')).toString())
  expect(after.items).toEqual(backup.items)
})
