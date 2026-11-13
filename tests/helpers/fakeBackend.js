/**
 * 测试用最小后端：一个内存数组 + 与 Hono 契约一致的 fetch 实现。
 *
 * 点赞 / 收藏按访客分别记账，模拟服务端用 Set 去重的 toggle 语义：
 * 同一个访客调用两次即回到原状态，不同访客互不影响。
 */

export const DEFAULT_VISITOR = 'anonymous'
export const MAX_VISITOR_ID_LENGTH = 64

/** 与 server 端保持一致的访客标识归一化：缺失 / 空白 / 超长都落到 anonymous */
export function normalizeVisitorId(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return DEFAULT_VISITOR
  if (raw.length > MAX_VISITOR_ID_LENGTH) return DEFAULT_VISITOR
  return raw
}

export function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }
}

function toCount(value) {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0
}

export function createFakeBackend(initialPosts = []) {
  const db = initialPosts.map((post) => ({ ...post }))
  const calls = []
  /** id → { likedBy, favoritedBy, baseLikes, baseFavorites } */
  const reactions = new Map()
  let seq = 0

  /**
   * 首次接触某条帖子时建立访客账本。
   * 种子里的计数是「包含种子访客在内的总数」，所以基数要先扣掉种子那一票，
   * 再由 likedBy / favoritedBy 的 Set 大小加回来，保证首次读取的总数不变。
   */
  function stateOf(post) {
    const key = String(post.id)
    const existing = reactions.get(key)
    if (existing) return existing

    const seedLiked = post.liked === true
    const seedFavorited = post.favorited === true
    const state = {
      likedBy: new Set(),
      favoritedBy: new Set(),
      baseLikes: Math.max(0, toCount(post.likes) - (seedLiked ? 1 : 0)),
      baseFavorites: Math.max(0, toCount(post.favorites) - (seedFavorited ? 1 : 0)),
      seedLiked,
      seedFavorited,
      bound: false
    }
    reactions.set(key, state)
    return state
  }

  /** 种子的 liked / favorited 属于「第一个来读的人」，读到时再绑到具体访客上 */
  function bindSeed(state, visitorId) {
    if (state.bound) return
    state.bound = true
    if (state.seedLiked) state.likedBy.add(visitorId)
    if (state.seedFavorited) state.favoritedBy.add(visitorId)
  }

  function readPost(post, visitorId) {
    const state = stateOf(post)
    bindSeed(state, visitorId)
    return {
      ...post,
      likes: state.baseLikes + state.likedBy.size,
      favorites: state.baseFavorites + state.favoritedBy.size,
      liked: state.likedBy.has(visitorId),
      favorited: state.favoritedBy.has(visitorId)
    }
  }

  async function fetchImpl(url, init = {}) {
    const path = String(url)
    const method = (init.method || 'GET').toUpperCase()
    const body = init.body ? JSON.parse(init.body) : null
    const headers = init.headers || {}
    const visitorId = normalizeVisitorId(headers['X-Visitor-Id'] ?? headers['x-visitor-id'])
    calls.push({ url: path, method, body, headers, visitorId })

    if (method === 'GET' && (path === '/api/posts' || path.startsWith('/api/posts?'))) {
      const match = path.match(/[?&]channel=([^&]+)/)
      const channel = match ? decodeURIComponent(match[1]) : null
      const posts = channel ? db.filter((post) => post.channel === channel) : db
      return jsonResponse({ posts: posts.map((post) => readPost(post, visitorId)) })
    }

    if (method === 'GET' && path.startsWith('/api/posts/')) {
      const id = decodeURIComponent(path.slice('/api/posts/'.length))
      const post = db.find((item) => String(item.id) === id)
      if (!post) {
        return jsonResponse({ error: { code: 'NOT_FOUND', message: '这条声音不在了' } }, 404)
      }
      return jsonResponse({ post: readPost(post, visitorId) })
    }

    if (method === 'POST' && path === '/api/posts') {
      seq += 1
      const post = {
        id: `srv-${seq}`,
        content: body.content,
        channel: body.channel,
        createdAt: Date.now() + seq,
        likes: 0,
        favorites: 0,
        liked: false,
        favorited: false
      }
      db.unshift(post)
      return jsonResponse({ post: readPost(post, visitorId) }, 201)
    }

    const toggleMatch = path.match(/^\/api\/posts\/([^/]+)\/(like|favorite)$/)
    if (method === 'POST' && toggleMatch) {
      const id = decodeURIComponent(toggleMatch[1])
      const kind = toggleMatch[2]
      const post = db.find((item) => String(item.id) === id)
      if (!post) {
        return jsonResponse({ error: { code: 'NOT_FOUND', message: '这条声音不在了' } }, 404)
      }

      const state = stateOf(post)
      bindSeed(state, visitorId)
      const set = kind === 'like' ? state.likedBy : state.favoritedBy
      if (set.has(visitorId)) set.delete(visitorId)
      else set.add(visitorId)

      return jsonResponse({ post: readPost(post, visitorId) })
    }

    if (method === 'DELETE' && path.startsWith('/api/posts/')) {
      const id = decodeURIComponent(path.slice('/api/posts/'.length))
      const index = db.findIndex((post) => String(post.id) === id)
      if (index === -1) {
        return jsonResponse({ error: { code: 'NOT_FOUND', message: '这条声音不在了' } }, 404)
      }
      db.splice(index, 1)
      reactions.delete(id)
      return {
        ok: true,
        status: 204,
        json: async () => {
          throw new Error('204 没有响应体')
        }
      }
    }

    return jsonResponse({ error: { code: 'NOT_FOUND', message: '找不到接口' } }, 404)
  }

  return { db, calls, fetchImpl }
}
