import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPostsApi, postsApi, ApiError } from '../../src/api/posts'

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
