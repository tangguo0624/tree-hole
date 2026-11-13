/**
 * 树洞数据访问层：前端唯一与后端 REST 接口通信的地方。
 *
 * 契约（与 server/ 保持一致）：
 * - GET    /api/posts?channel=<shade|night|breeze|all> → 200 { posts: Post[] }（createdAt 倒序）
 * - POST   /api/posts  body { content, channel }        → 201 { post: Post }
 * - DELETE /api/posts/:id                               → 204
 * - 出错 → 非 2xx + { error: { code, message } }
 */

export const NETWORK_ERROR = 'NETWORK_ERROR'
export const BAD_RESPONSE = 'BAD_RESPONSE'
export const FALLBACK_ERROR_MESSAGE = '请求没能完成，请稍后再试'

export class ApiError extends Error {
  constructor(message, { status = 0, code = NETWORK_ERROR, cause } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    if (cause) this.cause = cause
  }
}

function isOk(response) {
  if (!response) return false
  if (typeof response.ok === 'boolean') return response.ok
  return response.status >= 200 && response.status < 300
}

async function readJson(response) {
  if (!response || typeof response.json !== 'function') return null
  try {
    return await response.json()
  } catch (error) {
    return null
  }
}

function toQuery(channel) {
  if (!channel || channel === 'all') return ''
  return `?channel=${encodeURIComponent(channel)}`
}

export function createPostsApi(options = {}) {
  const baseUrl = String(options.baseUrl ?? '/api').replace(/\/+$/, '')
  // 不在这里固化 globalThis.fetch：调用时再取，测试可用 vi.stubGlobal 整体替换
  const injectedFetch = options.fetchImpl

  async function request(path, init) {
    const doFetch = injectedFetch ?? globalThis.fetch
    if (typeof doFetch !== 'function') {
      throw new ApiError('当前环境不支持网络请求', { status: 0, code: NETWORK_ERROR })
    }

    try {
      return await doFetch(`${baseUrl}${path}`, init)
    } catch (cause) {
      throw new ApiError('网络连接失败，请稍后再试', { status: 0, code: NETWORK_ERROR, cause })
    }
  }

  async function ensureOk(response) {
    if (isOk(response)) return

    const payload = await readJson(response)
    const detail = payload && typeof payload === 'object' ? payload.error : null
    const status = typeof response?.status === 'number' ? response.status : 0

    throw new ApiError(detail?.message || FALLBACK_ERROR_MESSAGE, {
      status,
      code: detail?.code || `HTTP_${status}`
    })
  }

  return {
    /** 拉取列表；channel 传 undefined 或 'all' 表示全部 */
    async list(channel) {
      const response = await request(`/posts${toQuery(channel)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      })
      await ensureOk(response)

      const payload = await readJson(response)
      if (!payload || !Array.isArray(payload.posts)) {
        throw new ApiError('服务端返回的数据格式不正确', {
          status: response?.status ?? 0,
          code: BAD_RESPONSE
        })
      }
      return payload.posts
    },

    async create({ content, channel } = {}) {
      const response = await request('/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ content, channel })
      })
      await ensureOk(response)

      const payload = await readJson(response)
      if (!payload || !payload.post || typeof payload.post !== 'object') {
        throw new ApiError('服务端返回的数据格式不正确', {
          status: response?.status ?? 0,
          code: BAD_RESPONSE
        })
      }
      return payload.post
    },

    async remove(id) {
      const response = await request(`/posts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' }
      })
      await ensureOk(response)
      return true
    }
  }
}

export const postsApi = createPostsApi()

export default postsApi
