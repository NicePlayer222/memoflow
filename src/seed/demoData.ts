import type { InboxDraft } from '../types/inbox'

export const demoData: InboxDraft[] = [
  {
    source: 'browser', title: '在浏览器里留一份自己的数据', url: 'https://dexie.org/',
    rawContent: 'Dexie 把 IndexedDB 的事务封装得很薄。下次做离线阅读器时，先试试断网刷新后能否找回最后一篇。',
    folderPath: ['开发', 'Local-first'], createdAt: '2026-11-23T09:20:00Z',
  },
  {
    source: 'markdown', title: 'A Pattern Language', url: 'https://www.patternlanguage.com/',
    rawContent: 'Reading note — windows on two sides make a room feel entirely different. Check the light in the studio after lunch.',
    createdAt: '2026-11-22T12:05:00Z',
  },
  {
    source: 'manual', title: '访谈摘记 · 菜场摊位的编号',
    rawContent: '阿姨找摊位靠的是“卖豆腐隔壁那家”，摊位号几乎没人提。下轮访谈带一张空白平面图，请她画自己的路线。',
    createdAt: '2026-11-21T02:15:00Z',
  },
  {
    source: 'x', title: 'Field recording tip', author: 'fieldnotes_demo',
    rawContent: 'Record thirty seconds of room tone before packing up. It saved the edit when the espresso machine cut out mid-sentence.',
    createdAt: '2026-11-20T16:04:00Z',
  },
  {
    source: 'browser', title: '汉字标点的挤压规则', url: 'https://www.w3.org/TR/clreq/',
    rawContent: '排版备忘：连续闭括号在窄栏内的间距。给读书卡片做竖屏版时对照例图。',
    folderPath: ['设计', 'Typography'], createdAt: '2026-11-20T08:40:00Z',
  },
  {
    source: 'markdown', title: 'The Art of Unix Programming', url: 'https://www.catb.org/~esr/writings/taoup/html/',
    rawContent: 'For the reading group: pick one command-line tool and trace exactly what it accepts on stdin.',
    createdAt: '2026-11-19T10:10:00Z',
  },
  {
    source: 'manual', title: '周六试做 · 冷萃比例',
    rawContent: '这次用 25 g 粗磨豆、300 g 水，冰箱里放 12 小时。尾段略苦，下次先缩短两小时，只改一个变量。',
    createdAt: '2026-11-18T22:00:00Z',
  },
  {
    source: 'browser', title: '行走地图底图', url: 'https://www.openstreetmap.org/',
    rawContent: '先印一份不带路线的底图，沿河散步时用铅笔补上台阶、长椅和能推车通行的入口。',
    folderPath: ['周末', '步行路线'], createdAt: '2026-11-18T04:45:00Z',
  },
  {
    source: 'x', title: '给空状态留一个动词', author: 'lin_design_demo',
    rawContent: '今天把“这里空空如也”改成了“粘贴第一条链接”。做可用性观察时，记一下用户第一次点击的位置。',
    createdAt: '2026-11-17T07:30:00Z',
  },
  {
    source: 'markdown', title: 'Observable Plot · small multiples', url: 'https://observablehq.com/plot/',
    rawContent: 'Try one tiny chart per district, all on the same y scale. The overall average hides the afternoon spike.',
    createdAt: '2026-11-16T14:25:00Z',
  },
  {
    source: 'manual', title: 'Listening walk: ferry terminal',
    rawContent: 'Start near the ticket gate at 7 am. Compare the warning bell on the pier with the echo under the covered walkway.',
    createdAt: '2026-11-16T00:15:00Z',
  },
  {
    source: 'browser', title: '故宫数字文物库', url: 'https://digicol.dpm.org.cn/',
    rawContent: '书签留给下次看展前用。把看中的三件瓷器按釉色排在一页，现场再补自己的观察。',
    folderPath: ['展览'], createdAt: '2026-11-15T05:35:00Z',
  },
  {
    source: 'markdown', title: 'React · choosing state structure', url: 'https://react.dev/learn/choosing-the-state-structure',
    rawContent: '把 selectedItem 改成 selectedId，修改列表后侧栏才不会留下旧标题。可用来讲重复状态。',
    createdAt: '2026-11-14T11:10:00Z',
  },
  {
    source: 'x', title: 'A useful question after a prototype test', author: 'studio_notes_demo',
    rawContent: 'Ask “What did you expect to happen?” right after a surprising click. Write down their exact verb before discussing the interface.',
    createdAt: '2026-11-13T13:02:00Z',
  },
  {
    source: 'manual', title: '给外婆扫描旧照片',
    rawContent: '先扫背面铅笔写的日期，再扫正面。文件名留卷号，在旁边的文本里记她认出来的人。',
    createdAt: '2026-11-12T09:00:00Z',
  },
  {
    source: 'browser', title: 'Public Domain Review', url: 'https://publicdomainreview.org/',
    rawContent: 'Look for botanical plates with the original margin notes still visible. Save the collection credit with each image.',
    folderPath: ['Visual references', 'Print'], createdAt: '2026-11-11T06:20:00Z',
  },
  {
    source: 'markdown', title: 'SQLite query planner', url: 'https://www.sqlite.org/queryplanner.html',
    rawContent: 'Workshop prep: draw a two-column index on paper and have someone find the first matching record by hand.',
    createdAt: '2026-11-10T03:45:00Z',
  },
  {
    source: 'manual', title: '用一段路测播客混音',
    rawContent: '带同一副耳机经过路口、商场和安静的小巷，记下哪句话被环境声盖住；回去只调整那一轨。',
    createdAt: '2026-11-09T15:55:00Z',
  },
  {
    source: 'browser', title: 'CSS Grid · named areas', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-areas',
    rawContent: 'Keep this for the volunteer roster. Named cells would make the print layout easier to adjust each week.',
    folderPath: ['开发', 'CSS'], createdAt: '2026-11-08T08:00:00Z',
  },
  {
    source: 'markdown', title: 'Standard Ebooks · 排版参考', url: 'https://standardebooks.org/',
    rawContent: '通勤时留意章节标题到首段之间的距离。试选一本短篇集，用夜间模式读完一章再做记录。',
    createdAt: '2026-11-07T23:50:00Z',
  },
]
