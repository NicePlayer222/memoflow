import type { Page } from '@playwright/test'
import { expect, test } from './browser'

const sampleCount = 1000
const query = '潮汐档案'
const targetTitle = `${query} · Tidal archive 0617`
const topics = ['独立阅读 · Reading', '城市观察 · Field notes', '声音采集 · Audio', '软件研究 · Development']
const markdown = Array.from({ length: sampleCount }, (_, i) => {
  const title = i === 617 ? targetTitle : `${topics[i % topics.length]} ${String(i).padStart(4, '0')}`
  return `[${title}](https://example.org/performance/${i}) · 调研笔记与实验记录 / research log entry ${i}`
}).join('\n')

// Start on the actual browser event and finish at the matching DOM commit.
// Driver actions and Playwright assertion polling fall outside these timings.
async function timeDom(page: Page, metric: string, event: string, selector: string, text?: string, key?: string) {
  await page.evaluate(({ metric, event, selector, text, key }) => {
    function capture(input: Event) {
      if (key && (!(input instanceof KeyboardEvent) || input.key !== key)) return
      document.removeEventListener(event, capture, true)
      const start = performance.now()
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector)
        if (!el || (text !== undefined && el.textContent !== text)) return
        performance.measure(metric, { start })
        observer.disconnect()
      })
      observer.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true })
    }
    document.addEventListener(event, capture, true)
  }, { metric, event, selector, text, key })
}

test('1000 mixed-language bookmarks: file import, scroll, cross-page keys, view and Chinese search', async ({ page, browser }) => {
  // Dexie binds the native transaction method when opening the database.
  // Install before navigation and arm it only for this file's import.
  await page.addInitScript(() => {
    let uploading = false
    document.addEventListener('change', event => {
      if (event.target instanceof HTMLInputElement && event.target.type === 'file') uploading = true
    }, true)
    const original = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = original.apply(this, args)
      if (uploading && this.name === 'memoflow' && tx.mode === 'readwrite' && tx.objectStoreNames.contains('items')) {
        uploading = false
        IDBDatabase.prototype.transaction = original
        const start = performance.now()
        tx.addEventListener('complete', () => performance.measure('perf.idb-write', { start }))
      }
      return tx
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: '暂停队列' }).click()
  await page.getByRole('button', { name: '导入', exact: true }).click()
  await timeDom(page, 'perf.upload-dom', 'change', '.list-header .count', '1000')
  await page.getByLabel('导入书签文件').setInputFiles({
    name: 'sample-1000.md', mimeType: 'text/markdown', buffer: Buffer.from(markdown),
  })
  const rows = page.getByTestId('inbox-row')
  await expect(page.getByRole('status').filter({ hasText: '已新增 1000 条，重复 0 条。' })).toBeVisible()
  await expect(page.locator('.list-header .count')).toHaveText('1000')
  await expect(rows).toHaveCount(60)

  const list = page.locator('.records')
  await list.evaluate(el => {
    el.addEventListener('wheel', () => {
      const start = performance.now()
      el.addEventListener('scroll', () => {
        requestAnimationFrame(() => performance.measure('perf.scroll-frame', { start }))
      }, { once: true })
    }, { capture: true, passive: true, once: true })
  })
  await list.hover()
  await page.mouse.wheel(0, 700)
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(0)

  const last = rows.last()
  await last.click()
  const previous = await last.getAttribute('data-id')
  expect(previous).toBeTruthy()
  await timeDom(page, 'perf.key-dom', 'keydown', `[data-testid="inbox-row"][data-selected="true"]:not([data-id="${previous}"])`, undefined, 'j')
  await page.keyboard.press('j')
  await expect(rows.first()).toHaveAttribute('data-selected', 'true')
  await expect(page.locator(`[data-id="${previous}"]`)).toHaveCount(0)
  await expect(rows).toHaveCount(60)
  await timeDom(page, 'perf.view-dom', 'click', '.list-header h1', '已就绪')
  await page.getByRole('button', { name: '已就绪', exact: true }).click()
  await expect(rows).toHaveCount(0)
  await expect(page.locator('.list-header .count')).toHaveText('0')

  await timeDom(page, 'perf.palette-dom', 'keydown', '[role="combobox"]', undefined, 'k')
  await page.keyboard.press('Control+k')
  const dialog = page.getByRole('dialog')
  await timeDom(page, 'perf.query-dom', 'input', '[cmdk-item] mark', query)
  await dialog.getByRole('combobox').fill(query)
  await expect(dialog.getByRole('option')).toHaveCount(1)
  await expect(dialog.getByRole('option')).toContainText(targetTitle)
  await expect(dialog.locator('mark').first()).toHaveText(query)
  await dialog.getByRole('option').click()
  await expect(page.getByTestId('detail-title')).toHaveText(targetTitle)
  await expect(page.locator('.list-header .count')).toHaveText('1000')

  const metrics = await page.evaluate(() => {
    function measurement(name: string) {
      const entry = performance.getEntriesByName(name, 'measure').at(-1) as PerformanceMeasure | undefined
      if (!entry) throw new Error(`Missing browser performance measure: ${name}`)
      return entry
    }
    return {
      userAgent: navigator.userAgent,
      imported: measurement('memoflow.import-items').detail.count as number,
      indexed: measurement('memoflow.search-index').detail.count as number,
      hits: measurement('memoflow.search-query').detail.matches as number,
      ms: {
        uploadToListDom: measurement('perf.upload-dom').duration,
        importItemsApi: measurement('memoflow.import-items').duration,
        indexedDbWriteTransaction: measurement('perf.idb-write').duration,
        wheelToScrolledFrame: measurement('perf.scroll-frame').duration,
        crossPageKeyToDom: measurement('perf.key-dom').duration,
        viewClickToDom: measurement('perf.view-dom').duration,
        shortcutToPaletteDom: measurement('perf.palette-dom').duration,
        indexBuild: measurement('memoflow.search-index').duration,
        chineseQuery: measurement('memoflow.search-query').duration,
        queryInputToHighlightedDom: measurement('perf.query-dom').duration,
      },
    }
  })
  console.log(`MemoFlow browser performance (single run, milliseconds) ${JSON.stringify({ version: browser.version(), ...metrics })}`)
  expect(metrics).toMatchObject({ imported: sampleCount, indexed: sampleCount, hits: 1 })
  expect(metrics.ms.uploadToListDom).toBeLessThan(10000)
  expect(metrics.ms.importItemsApi).toBeLessThan(5000)
  expect(metrics.ms.indexedDbWriteTransaction).toBeLessThan(5000)
  expect(metrics.ms.indexBuild).toBeLessThan(2000)
  expect(metrics.ms.shortcutToPaletteDom).toBeLessThan(3000)
  expect(metrics.ms.chineseQuery).toBeLessThan(500)
  expect(metrics.ms.queryInputToHighlightedDom).toBeLessThan(1000)
  expect(metrics.ms.crossPageKeyToDom).toBeLessThan(1000)
  expect(metrics.ms.viewClickToDom).toBeLessThan(1000)
  expect(metrics.ms.wheelToScrolledFrame).toBeLessThan(1000)
})
