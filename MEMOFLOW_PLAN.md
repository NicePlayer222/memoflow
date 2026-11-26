# MemoFlow — Local-First AI Semantic Inbox Execution Plan

## 1. Architecture Guardrails (Non-Negotiable)
- **Zero Backend**: No login, no server DB, no server-side scraping. All data lives in browser IndexedDB (`Dexie.js`).
- **No Live Web Scraping**: Never `fetch()` arbitrary bookmark URLs from the browser (CORS fails). Analyze only imported text, titles, URLs, folder paths, and optional user notes.
- **Single AI Protocol**: Use OpenAI-compatible `POST {baseUrl}/chat/completions` (supports DeepSeek, OpenAI, Gemini OpenAI-compat endpoint, Ollama). No heavy vendor SDKs.
- **Zero-Key Demo First**: Ship with 20 realistic mixed ZH/EN seed items and a deterministic `MockProvider` so every feature works without an API key.
- **Simplicity**: React state/context + Dexie `useLiveQuery`. No Redux/MobX.

## 2. Tech Stack & Directory Layout
- Stack: Vite + React 19 + TypeScript (strict) + Tailwind CSS + `lucide-react` + `cmdk` + `dexie` + `minisearch` + `fflate` + `vitest` + `fake-indexeddb` + `playwright`.
- Layout:
  - `src/types/inbox.ts` (InboxItem, QueueJob, ProviderConfig)
  - `src/db/index.ts` (Dexie schema & deduped batch import)
  - `src/parsers/` (`normalizeUrl.ts`, `xBookmarks.ts`, `browserHtml.ts`, `markdownLinks.ts`)
  - `src/ai/` (`provider.ts`, `prompt.ts`, `schema.ts`, `queue.ts`)
  - `src/search/index.ts` (MiniSearch with Latin + CJK 2-gram tokenizer)
  - `src/export/` (`markdown.ts`, `backupJson.ts`)
  - `src/seed/demoData.ts`
  - `src/components/`, `src/pages/`, `tests/unit/`, `tests/e2e/`

## 3. Core Data Contract (`InboxItem`)
- `id` (UUID), `source` (`x` | `browser` | `markdown` | `manual`), `url?`, `canonicalUrl?` (lowercase host, stripped `utm_*`/`fbclid`/`ref`/`s`/`t` params and trailing slash), `title`, `rawContent`, `author?`, `createdAt`, `importedAt`, `status` (`pending` | `processing` | `ready` | `failed` | `archived`), `errorMessage?`, `fingerprint` (stable hash for dedup).
- `ai?`: `{ summary (<=120 chars), category (1 of 6-8 buckets), tags (2-5), takeaways (1-3), searchKeywords (3-8 bilingual/synonym terms), processedAt, model }`.

## 4. Milestones & Acceptance Gates
- **Milestone 1 (Foundation, DB & Parsers)**:
  - Scaffold project, Dexie DB with dedup import, 3 parsers (X JSON nested/flat, Netscape HTML with folder paths, Markdown/bare URLs) + URL normalizer, 20 mixed ZH/EN seed items, minimal smoke `App.tsx`, unit tests with dirty fixtures.
  - Gate: `npm run typecheck && npm run test && npm run build` all pass.
- **Milestone 2 (AI Queue & Dual Providers)**:
  - OpenAI-compat provider + strict JSON validator + deterministic `MockProvider` + persistent concurrency-limited queue (default 2, max 5, retry x2 with exponential backoff on 429/5xx, auto-reset `processing` to `pending` on reload, pause/resume/retry failed).
  - Gate: Queue unit tests pass + 20 seed items finish cleanly in Mock mode + `typecheck/test/build` pass.
- **Milestone 3 (Workspace UI, CJK Search & Keyboard Flow)**:
  - Linear-style 3-pane workspace, dark mode, status tabs, `Cmd+K` search with CJK 2-gram + Latin tokenizer, keyboard shortcuts (`j/k`, `e`, `r`), Settings modal for BYOK presets.
  - Gate: Playwright E2E covers seed -> Mock process -> Chinese search hit -> shortcut archive with 0 console errors.
- **Milestone 4 (Tag Governance & Export/Backup)**:
  - Tag rename/merge (e.g. merge `AI` into `人工智能`), topic view, Markdown export (single file & YAML-frontmatter ZIP via `fflate`), full JSON backup/restore.
  - Gate: Export validation tests + backup/clear/restore roundtrip matches 100%.
- **Milestone 5 (Stress Test, Polish & Deploy Config)**:
  - Empty/loading/error states, 1000 synthetic items scroll/search perf verification, responsive layout, README & static deploy config.
  - Gate: `typecheck + test + build + test:e2e` all green.
