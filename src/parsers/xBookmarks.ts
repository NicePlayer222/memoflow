import type { InboxDraft } from '../types/inbox'
import { normalizeUrl } from './normalizeUrl'

type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {}
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
}

function tweetId(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && /^\d+$/.test(value)) return value
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  }
}

function readTweet(tweet: JsonObject): InboxDraft | undefined {
  const legacy = object(tweet.legacy)
  const user = object(object(object(tweet.core).user_results).result)
  const author = object(tweet.author ?? tweet.user)
  const handle = firstText(object(user.core).screen_name, object(user.legacy).screen_name,
    author.screen_name, author.username, tweet.screen_name, tweet.username)
  const note = object(object(object(tweet.note_tweet).note_tweet_results).result)
  const content = firstText(note.text, legacy.full_text, legacy.text, tweet.full_text, tweet.text, tweet.content)
  const id = tweetId(tweet.rest_id, legacy.id_str, tweet.id_str, tweet.tweetId, tweet.tweet_id, tweet.id)
  const link = firstText(tweet.url, tweet.permalink)
  let url = link && normalizeUrl(link) ? link : undefined
  if (!url && id) {
    const username = handle?.replace(/^@/, '')
    const path = username && /^\w+$/.test(username) ? username : 'i/web'
    url = `https://x.com/${path}/status/${id}`
  }
  const title = firstText(tweet.title) ?? content?.split(/\r?\n/, 1)[0] ?? url
  if (!title || (!url && !content)) return

  const date = firstText(legacy.created_at, tweet.created_at, tweet.createdAt)
  const timestamp = date ? Date.parse(date) : NaN
  return {
    source: 'x',
    title,
    rawContent: content ?? '',
    url,
    author: handle ?? firstText(tweet.author, author.name, object(user.core).name, object(user.legacy).name),
    createdAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined,
  }
}

// Follow bookmark containers only. Quoted tweets, user profiles and URL entities
// inside a tweet are metadata, not additional bookmarks.
const containers = ['data', 'bookmarks', 'items', 'tweets', 'bookmark_timeline', 'bookmark_timeline_v2', 'timeline',
  'instructions', 'entries', 'content', 'item', 'itemContent', 'tweet_results', 'result', 'tweet', 'bookmark']

export function parseXBookmarks(text: string): InboxDraft[] {
  const bookmarks: InboxDraft[] = []
  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const node = object(value)
    if (node.__typename === 'TweetUnavailable' || node.__typename === 'TweetTombstone') return
    const children = containers.filter(key => node[key] !== null && typeof node[key] === 'object')
    if (children.length) {
      for (const key of children) visit(node[key])
    } else {
      const draft = readTweet(node)
      if (draft) bookmarks.push(draft)
    }
  }
  visit(JSON.parse(text.trim()))
  return bookmarks
}
