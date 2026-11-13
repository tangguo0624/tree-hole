import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPostsApi, postsApi, ApiError } from '../../src/api/posts'
import { getVisitorId, VISITOR_STORAGE_KEY } from '../../src/utils/visitor'

let fetchMock
let api

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }
}

beforeEach(() => {
  fetchMock = vi.fn()
  api = createPostsApi({ fetchImpl: fetchMock })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createPostsApi / list', () => {
  it('默认请求 /api/posts 并返回 posts 数组', async () => {
    fetchMock.mockResolvedValueOnce(response({ posts: [{ id: '1', content: 'x', createdAt: 1, channel: 'shade' }] }))

    const posts = await api.list()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/posts')
    expect(posts.length).toBe(1)
  })

  it('传频道时拼上 channel 查询参数，传 all 时忽略', async () => {
    fetchMock.mockResolvedValue(response({ posts: [] }))

    await api.list('night')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/posts?channel=night')

    await api.list('all')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/posts')
  })

  it('自定义 baseUrl 生效', async () => {
    const custom = createPostsApi({ baseUrl: '/v1/api/', fetchImpl: fetchMock })
    fetchMock.mockResolvedValueOnce(response({ posts: [] }))

    await custom.list()

    expect(fetchMock.mock.calls[0][0]).toBe('/v1/api/posts')
  })

  it('响应体不是 { posts: [] } 时抛 BAD_RESPONSE', async () => {
    fetchMock.mockResolvedValueOnce(response({ nope: true }))

    const error = await api.list().catch((err) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('BAD_RESPONSE')
  })
})

describe('createPostsApi / create', () => {
  it('POST JSON 并返回后端创建好的 post', async () => {
    const created = { id: 'srv-1', content: '你好', createdAt: 123, channel: 'shade' }
    fetchMock.mockResolvedValueOnce(response({ post: created }, 201))

    const post = await api.create({ content: '你好', channel: 'shade' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/posts')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ content: '你好', channel: 'shade' })
    expect(post).toEqual(created)
  })

  it('响应缺少 post 字段时抛 BAD_RESPONSE', async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: true }, 201))

    const error = await api.create({ content: 'x', channel: 'shade' }).catch((err) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('BAD_RESPONSE')
  })
})

describe('createPostsApi / remove', () => {
  it('DELETE /api/posts/:id 且 204 不解析响应体', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error('204 没有响应体')
      }
    })

    await expect(api.remove('srv-1')).resolves.toBe(true)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/posts/srv-1')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })

  it('id 会被 URL 编码', async () => {
    fetchMock.mockResolvedValueOnce(response(null, 204))

    await api.remove('a/b c')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/posts/a%2Fb%20c')
  })
})

describe('createPostsApi / 错误处理', () => {
  it('非 2xx 抛 ApiError，携带 status/code/message', async () => {
    fetchMock.mockResolvedValueOnce(response({ error: { code: 'INVALID_CHANNEL', message: '频道不存在' } }, 400))

    const error = await api.list().catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.code).toBe('INVALID_CHANNEL')
    expect(error.message).toBe('频道不存在')
  })

  it('5xx 且响应体不是 JSON 时仍给出可读错误', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json')
      }
    })

    const error = await api.list().catch((err) => err)

    expect(error.status).toBe(500)
    expect(error.code).toBe('HTTP_500')
    expect(error.message).toBeTruthy()
  })

  it('网络异常统一为 NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const error = await api.list().catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.code).toBe('NETWORK_ERROR')
  })

  it('默认实例在调用时才解析 globalThis.fetch，可被 stubGlobal 替换', async () => {
    const stub = vi.fn().mockResolvedValue(response({ posts: [] }))
    vi.stubGlobal('fetch', stub)

    await postsApi.list()

    expect(stub).toHaveBeenCalledTimes(1)
  })
})

describe('createPostsApi / 访客标识', () => {
  it('getVisitorId 惰性生成一次，长度落在服务端接受范围内', () => {
    const first = getVisitorId()

    expect(typeof first).toBe('string')
    expect(first.length).toBeGreaterThan(0)
    expect(first.length).toBeLessThanOrEqual(64)
    expect(getVisitorId()).toBe(first)
  })

  it('list / create / remove 都带同一个 X-Visitor-Id', async () => {
    fetchMock.mockResolvedValueOnce(response({ posts: [] }))
    await api.list()

    fetchMock.mockResolvedValueOnce(response({ post: { id: '1', content: 'x', createdAt: 1, channel: 'shade' } }, 201))
    await api.create({ content: 'x', channel: 'shade' })

    fetchMock.mockResolvedValueOnce(response(null, 204))
    await api.remove('1')

    const visitorIds = fetchMock.mock.calls.map(([, init]) => init.headers['X-Visitor-Id'])
    expect(visitorIds[0]).toBeTruthy()
    expect(visitorIds[1]).toBe(visitorIds[0])
    expect(visitorIds[2]).toBe(visitorIds[0])
  })

  it('标识写入 sessionStorage，刷新（重新加载模块）后复用同一个身份', async () => {
    sessionStorage.clear()
    vi.resetModules()

    const first = (await import('../../src/utils/visitor')).getVisitorId()
    expect(sessionStorage.getItem(VISITOR_STORAGE_KEY)).toBe(first)

    // 模拟刷新：模块缓存被清空，但仍应读到同一份会话标识
    vi.resetModules()
    const reloaded = (await import('../../src/utils/visitor')).getVisitorId()
    expect(reloaded).toBe(first)
  })

  it('sessionStorage 里是空白脏数据时重新生成并覆盖', async () => {
    sessionStorage.setItem(VISITOR_STORAGE_KEY, '   ')
    vi.resetModules()

    const id = (await import('../../src/utils/visitor')).getVisitorId()

    expect(id.trim()).toBeTruthy()
    expect(sessionStorage.getItem(VISITOR_STORAGE_KEY)).toBe(id)
  })
})

describe('createPostsApi / toggleLike 与 toggleFavorite', () => {
  function toggledPost(overrides = {}) {
    return { id: 'p-1', content: '你好', createdAt: 1, channel: 'shade', likes: 4, favorites: 2, liked: true, favorited: false, ...overrides }
  }

  it('toggleLike POST /api/posts/:id/like，返回归一化的 post', async () => {
    const post = toggledPost()
    fetchMock.mockResolvedValueOnce(response({ post }))

    const result = await api.toggleLike('p-1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/posts/p-1/like')
    expect(init.method).toBe('POST')
    expect(init.headers['X-Visitor-Id']).toBeTruthy()
    expect(result).toEqual(post)
  })

  it('toggleFavorite POST /api/posts/:id/favorite，返回归一化的 post', async () => {
    const post = toggledPost({ favorited: true, favorites: 3 })
    fetchMock.mockResolvedValueOnce(response({ post }))

    const result = await api.toggleFavorite('p-1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/posts/p-1/favorite')
    expect(init.method).toBe('POST')
    expect(result).toEqual(post)
  })

  it('id 会被 URL 编码', async () => {
    fetchMock.mockResolvedValueOnce(response({ post: toggledPost() }))

    await api.toggleLike('a/b c')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/posts/a%2Fb%20c/like')
  })

  it('404 时抛 ApiError，带上服务端中文文案与 code', async () => {
    fetchMock.mockResolvedValueOnce(response({ error: { code: 'NOT_FOUND', message: '这条声音不在了' } }, 404))

    const error = await api.toggleFavorite('gone').catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.code).toBe('NOT_FOUND')
    expect(error.message).toBe('这条声音不在了')
  })

  it('网络异常统一为 NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const error = await api.toggleLike('p-1').catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.code).toBe('NETWORK_ERROR')
  })

  it('响应缺少 post 字段时抛 BAD_RESPONSE', async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: true }))

    const error = await api.toggleLike('p-1').catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('BAD_RESPONSE')
  })
})
