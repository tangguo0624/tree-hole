/**
 * Hono 应用工厂：只负责 HTTP 契约（路由 / 校验 / 错误结构），
 * 不监听端口、不依赖进程环境，方便用 app.request() 直接测试。
 */
import { Hono } from 'hono'
import {
  ALL_CHANNELS,
  CHANNELS,
  DEFAULT_CHANNEL,
  MAX_CONTENT_LENGTH,
  createPostStore,
  isChannel,
  normalizeVisitorId
} from './store.js'

export const ERROR_CODES = Object.freeze({
  INVALID_CHANNEL: 'INVALID_CHANNEL',
  INVALID_CONTENT: 'INVALID_CONTENT',
  INVALID_JSON: 'INVALID_JSON',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
})

/** 按 Unicode 码点截断，避免把 emoji 的代理对切开 */
function truncate(text, limit) {
  const chars = Array.from(text)
  return chars.length > limit ? chars.slice(0, limit).join('') : text
}

function fail(c, status, code, message) {
  return c.json({ error: { code, message } }, status)
}

/**
 * 访客身份只来自请求头，服务端不接受请求体或查询参数注入，
 * 避免客户端伪造别人的 liked / favorited 视图。
 */
function visitorOf(c) {
  return normalizeVisitorId(c.req.header('X-Visitor-Id'))
}

/**
 * @param {{ store?: ReturnType<typeof createPostStore> }} [options]
 */
export function createApp(options = {}) {
  const store = options.store ?? createPostStore()
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  app.get('/api/posts', (c) => {
    const raw = c.req.query('channel')
    const channel = raw === undefined || raw === '' ? ALL_CHANNELS : raw

    if (channel !== ALL_CHANNELS && !isChannel(channel)) {
      return fail(c, 400, ERROR_CODES.INVALID_CHANNEL, `channel 只能是 ${[ALL_CHANNELS, ...CHANNELS].join(' / ')}`)
    }

    return c.json({ posts: store.list({ channel, visitorId: visitorOf(c) }) })
  })

  app.post('/api/posts', async (c) => {
    let payload
    try {
      payload = JSON.parse(await c.req.text())
    } catch {
      return fail(c, 400, ERROR_CODES.INVALID_JSON, '请求体不是合法 JSON')
    }

    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return fail(c, 400, ERROR_CODES.INVALID_JSON, '请求体必须是 JSON 对象')
    }

    if (typeof payload.content !== 'string') {
      return fail(c, 400, ERROR_CODES.INVALID_CONTENT, 'content 必须是非空字符串')
    }

    const content = truncate(payload.content.trim(), MAX_CONTENT_LENGTH)
    if (!content) {
      return fail(c, 400, ERROR_CODES.INVALID_CONTENT, 'content 不能为空')
    }

    const rawChannel = payload.channel
    const channel = rawChannel === undefined || rawChannel === null || rawChannel === ''
      ? DEFAULT_CHANNEL
      : rawChannel

    if (!isChannel(channel)) {
      return fail(c, 400, ERROR_CODES.INVALID_CHANNEL, `channel 只能是 ${CHANNELS.join(' / ')}`)
    }

    const post = store.create({ content, channel })
    c.header('Location', `/api/posts/${post.id}`)

    return c.json({ post }, 201)
  })

  app.get('/api/posts/:id', (c) => {
    const post = store.get(c.req.param('id'), visitorOf(c))
    if (!post) {
      return fail(c, 404, ERROR_CODES.NOT_FOUND, '帖子不存在')
    }
    return c.json({ post })
  })

  /**
   * 点赞 / 收藏都是 toggle：同一个访客再点一次即取消，无需额外的 DELETE 接口。
   * 两个接口都不读请求体，计数与状态全部由服务端派生。
   */
  const toggleRoute = (action) => (c) => {
    const post = store[action](c.req.param('id'), visitorOf(c))
    if (!post) {
      return fail(c, 404, ERROR_CODES.NOT_FOUND, '帖子不存在')
    }
    return c.json({ post })
  }

  app.post('/api/posts/:id/like', toggleRoute('toggleLike'))
  app.post('/api/posts/:id/favorite', toggleRoute('toggleFavorite'))

  app.delete('/api/posts/:id', (c) => {
    const removed = store.remove(c.req.param('id'))
    if (!removed) {
      return fail(c, 404, ERROR_CODES.NOT_FOUND, '帖子不存在')
    }
    return c.body(null, 204)
  })

  app.notFound((c) => fail(c, 404, ERROR_CODES.NOT_FOUND, `未找到 ${c.req.method} ${c.req.path}`))

  app.onError((error, c) => {
    console.error('[api] 未捕获异常：', error)
    return fail(c, 500, ERROR_CODES.INTERNAL_ERROR, '服务器内部错误')
  })

  return app
}
