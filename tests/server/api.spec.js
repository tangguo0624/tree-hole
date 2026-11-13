// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { createApp } from '../../server/app.js'
import { createPostStore, MAX_CONTENT_LENGTH } from '../../server/store.js'

function setup({ nows = [], ids = [] } = {}) {
  const nowQueue = [...nows]
  const idQueue = [...ids]
  let tick = 0
  let idTick = 0

  const store = createPostStore({
    now: () => (nowQueue.length ? nowQueue.shift() : 1_700_000_000_000 + ++tick),
    idFactory: () => (idQueue.length ? idQueue.shift() : `id-${++idTick}`)
  })

  return { app: createApp({ store }), store }
}

const jsonInit = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body)
})

async function expectError(response, status, code) {
  expect(response.status).toBe(status)
  const payload = await response.json()
  expect(payload.error).toBeTypeOf('object')
  expect(payload.error.code).toBe(code)
  expect(payload.error.message).toBeTypeOf('string')
  expect(payload.error.message.length).toBeGreaterThan(0)
}

describe('GET /api/health', () => {
  let app

  beforeEach(() => {
    ;({ app } = setup())
  })

  it('返回 200 与 { status: "ok" }，Content-Type 为 JSON', async () => {
    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/^application\/json/)
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })
})

describe('GET /api/posts', () => {
  let app

  beforeEach(() => {
    ;({ app } = setup())
  })

  it('空列表返回 { posts: [] }', async () => {
    const response = await app.request('/api/posts')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ posts: [] })
  })

  it('按 createdAt 倒序返回，省略 channel 返回全部', async () => {
    const { app: local, store } = setup({ nows: [1_000, 2_000, 3_000] })
    store.create({ content: '最早', channel: 'shade' })
    store.create({ content: '中间', channel: 'night' })
    store.create({ content: '最新', channel: 'breeze' })

    const body = await (await local.request('/api/posts')).json()

    expect(body.posts.map((post) => post.content)).toEqual(['最新', '中间', '最早'])
  })

  it('channel=all 返回全部', async () => {
    const { app: local, store } = setup()
    store.create({ content: 's', channel: 'shade' })
    store.create({ content: 'n', channel: 'night' })

    const body = await (await local.request('/api/posts?channel=all')).json()

    expect(body.posts).toHaveLength(2)
  })

  it('按单一频道过滤', async () => {
    const { app: local, store } = setup()
    store.create({ content: 's', channel: 'shade' })
    store.create({ content: 'n', channel: 'night' })
    store.create({ content: 'b', channel: 'breeze' })

    const body = await (await local.request('/api/posts?channel=night')).json()

    expect(body.posts.map((post) => post.content)).toEqual(['n'])
    expect(body.posts[0].channel).toBe('night')
  })

  it('非法 channel 返回 400 INVALID_CHANNEL', async () => {
    const response = await app.request('/api/posts?channel=unknown')
    await expectError(response, 400, 'INVALID_CHANNEL')
  })
})

describe('POST /api/posts', () => {
  let app

  beforeEach(() => {
    ;({ app } = setup())
  })

  it('创建成功返回 201、Location 与规范化 Post', async () => {
    const response = await app.request('/api/posts', jsonInit({ content: '你好，树洞', channel: 'night' }))

    expect(response.status).toBe(201)
    expect(response.headers.get('content-type')).toMatch(/^application\/json/)
    expect(response.headers.get('location')).toBe('/api/posts/id-1')

    const { post } = await response.json()
    expect(post).toEqual({
      id: 'id-1',
      content: '你好，树洞',
      createdAt: 1_700_000_000_001,
      channel: 'night',
      likes: 0,
      favorites: 0,
      liked: false,
      favorited: false
    })
  })

  it('服务端生成 id / createdAt，忽略客户端传入值', async () => {
    const response = await app.request(
      '/api/posts',
      jsonInit({ id: 'hacked', createdAt: 42, content: '客户端伪造', channel: 'shade' })
    )

    const { post } = await response.json()
    expect(post.id).toBe('id-1')
    expect(post.createdAt).toBeGreaterThan(42)
  })

  it('channel 缺省为 shade', async () => {
    const response = await app.request('/api/posts', jsonInit({ content: '默认频道' }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ post: { channel: 'shade' } })
  })

  it('content 去除首尾空白', async () => {
    const response = await app.request('/api/posts', jsonInit({ content: '  \n 有空格 \t ' }))

    await expect(response.json()).resolves.toMatchObject({ post: { content: '有空格' } })
  })

  it('超长 content 静默截断到 300 字符', async () => {
    const response = await app.request('/api/posts', jsonInit({ content: 'a'.repeat(400) }))

    expect(response.status).toBe(201)
    const { post } = await response.json()
    expect(post.content).toHaveLength(MAX_CONTENT_LENGTH)
  })

  it('空串 / 纯空白 content 返回 400 INVALID_CONTENT', async () => {
    await expectError(await app.request('/api/posts', jsonInit({ content: '' })), 400, 'INVALID_CONTENT')
    await expectError(await app.request('/api/posts', jsonInit({ content: '   \n ' })), 400, 'INVALID_CONTENT')
  })

  it('缺失或非字符串 content 返回 400 INVALID_CONTENT', async () => {
    await expectError(await app.request('/api/posts', jsonInit({})), 400, 'INVALID_CONTENT')
    await expectError(await app.request('/api/posts', jsonInit({ content: 123 })), 400, 'INVALID_CONTENT')
    await expectError(await app.request('/api/posts', jsonInit({ content: null })), 400, 'INVALID_CONTENT')
  })

  it('非法 channel 返回 400 INVALID_CHANNEL', async () => {
    await expectError(
      await app.request('/api/posts', jsonInit({ content: 'x', channel: 'spam' })),
      400,
      'INVALID_CHANNEL'
    )
  })

  it('请求体不是合法 JSON 返回 400 INVALID_JSON', async () => {
    await expectError(await app.request('/api/posts', jsonInit('{oops')), 400, 'INVALID_JSON')
  })

  it('请求体不是对象（数组 / null / 字符串）返回 400 INVALID_JSON', async () => {
    await expectError(await app.request('/api/posts', jsonInit([])), 400, 'INVALID_JSON')
    await expectError(await app.request('/api/posts', jsonInit(null)), 400, 'INVALID_JSON')
    await expectError(await app.request('/api/posts', jsonInit('"just a string"')), 400, 'INVALID_JSON')
  })

  it('空请求体返回 400 INVALID_JSON', async () => {
    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' }
    })

    await expectError(response, 400, 'INVALID_JSON')
  })

  it('创建后可被列表与详情读到', async () => {
    const created = await (await app.request('/api/posts', jsonInit({ content: '持久一点' }))).json()

    const list = await (await app.request('/api/posts')).json()
    expect(list.posts).toHaveLength(1)

    const detail = await (await app.request(`/api/posts/${created.post.id}`)).json()
    expect(detail).toEqual({ post: created.post })
  })
})

describe('GET /api/posts/:id', () => {
  it('命中返回 200 { post }', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '存在', channel: 'breeze' })

    const response = await app.request(`/api/posts/${created.id}`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ post: created })
  })

  it('未命中返回 404 NOT_FOUND', async () => {
    const { app } = setup()
    await expectError(await app.request('/api/posts/not-exist'), 404, 'NOT_FOUND')
  })
})

describe('DELETE /api/posts/:id', () => {
  it('删除成功返回 204 且无 body', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '待删' })

    const response = await app.request(`/api/posts/${created.id}`, { method: 'DELETE' })

    expect(response.status).toBe(204)
    await expect(response.text()).resolves.toBe('')
    expect(store.get(created.id)).toBeUndefined()
    await expectError(await app.request(`/api/posts/${created.id}`), 404, 'NOT_FOUND')
  })

  it('未命中返回 404 NOT_FOUND', async () => {
    const { app } = setup()
    await expectError(await app.request('/api/posts/nope', { method: 'DELETE' }), 404, 'NOT_FOUND')
  })
})

describe('边界与防御性用例', () => {
  it('channel 查询参数为空串时视为 all', async () => {
    const { app, store } = setup()
    store.create({ content: 's', channel: 'shade' })
    store.create({ content: 'n', channel: 'night' })

    const body = await (await app.request('/api/posts?channel=')).json()

    expect(body.posts).toHaveLength(2)
  })

  it('content 恰好 300 字符不截断，301 字符截断', async () => {
    const { app } = setup()

    const exact = await (await app.request('/api/posts', jsonInit({ content: 'b'.repeat(300) }))).json()
    expect(exact.post.content).toHaveLength(300)

    const over = await (await app.request('/api/posts', jsonInit({ content: 'c'.repeat(301) }))).json()
    expect(over.post.content).toHaveLength(300)
  })

  it('截断按码点进行，不切碎 emoji', async () => {
    const { app } = setup()
    const response = await app.request('/api/posts', jsonInit({ content: '🌲'.repeat(400) }))

    const { post } = await response.json()
    expect(Array.from(post.content)).toHaveLength(300)
    expect(post.content).toBe('🌲'.repeat(300))
  })

  it('忽略未知字段，只返回约定字段', async () => {
    const { app } = setup()
    const response = await app.request(
      '/api/posts',
      jsonInit({ content: '多余字段', channel: 'breeze', extra: { a: 1 }, author: 'me' })
    )

    const { post } = await response.json()
    expect(Object.keys(post).sort()).toEqual([
      'channel',
      'content',
      'createdAt',
      'favorited',
      'favorites',
      'id',
      'liked',
      'likes'
    ])
  })

  it('204 响应无 body 且不带 JSON Content-Type', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '删除我' })

    const response = await app.request(`/api/posts/${created.id}`, { method: 'DELETE' })

    expect(response.status).toBe(204)
    expect(response.headers.get('content-type')).toBeNull()
  })

  it('重复删除同一 id 第二次返回 404', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '删两次' })

    await app.request(`/api/posts/${created.id}`, { method: 'DELETE' })
    await expectError(await app.request(`/api/posts/${created.id}`, { method: 'DELETE' }), 404, 'NOT_FOUND')
  })
})

describe('POST /api/posts/:id/like', () => {
  /** toggle 接口无请求体，只靠 X-Visitor-Id 头区分访客 */
  const toggleInit = (visitorId) => ({
    method: 'POST',
    headers: visitorId === undefined ? {} : { 'X-Visitor-Id': visitorId }
  })

  it('点赞成功返回 200 与完整访客态 Post', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '点我' })

    const response = await app.request(`/api/posts/${created.id}/like`, toggleInit('alice'))

    expect(response.status).toBe(200)
    const { post } = await response.json()
    expect(post).toEqual({
      id: created.id,
      content: '点我',
      createdAt: created.createdAt,
      channel: 'shade',
      likes: 1,
      favorites: 0,
      liked: true,
      favorited: false
    })
  })

  it('再次调用取消点赞（toggle 幂等安全）', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '再来一次' })

    await app.request(`/api/posts/${created.id}/like`, toggleInit('alice'))
    const { post } = await (await app.request(`/api/posts/${created.id}/like`, toggleInit('alice'))).json()

    expect(post).toMatchObject({ likes: 0, liked: false })
  })

  it('不同访客的点赞互不影响，各自看到自己的 liked', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '两个访客' })

    await app.request(`/api/posts/${created.id}/like`, toggleInit('alice'))

    const forAlice = await (await app.request(`/api/posts/${created.id}`, { headers: { 'X-Visitor-Id': 'alice' } })).json()
    const forBob = await (await app.request(`/api/posts/${created.id}`, { headers: { 'X-Visitor-Id': 'bob' } })).json()

    expect(forAlice.post).toMatchObject({ likes: 1, liked: true })
    expect(forBob.post).toMatchObject({ likes: 1, liked: false })
  })

  it('缺失 X-Visitor-Id 归一到 anonymous', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '匿名访客' })

    await app.request(`/api/posts/${created.id}/like`, toggleInit())
    const anonymous = await (await app.request(`/api/posts/${created.id}`)).json()

    expect(anonymous.post).toMatchObject({ likes: 1, liked: true })

    // 显式 anonymous 与缺失头是同一个人，再点一次应取消
    const explicit = await (await app.request(`/api/posts/${created.id}/like`, toggleInit('anonymous'))).json()
    expect(explicit.post).toMatchObject({ likes: 0, liked: false })
  })

  it('超长 X-Visitor-Id 归一为 anonymous', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '超长标识' })

    const response = await app.request(`/api/posts/${created.id}/like`, toggleInit('a'.repeat(65)))
    const { post } = await response.json()

    expect(response.status).toBe(200)
    expect(post).toMatchObject({ likes: 1, liked: true })

    const anonymous = await (await app.request(`/api/posts/${created.id}`)).json()
    expect(anonymous.post.liked).toBe(true)
  })

  it('未命中返回 404 NOT_FOUND 与中文文案', async () => {
    const { app } = setup()
    const response = await app.request('/api/posts/missing/like', toggleInit('alice'))

    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.error.code).toBe('NOT_FOUND')
    expect(payload.error.message).toMatch(/[\u4e00-\u9fa5]/)
  })

  it('忽略请求体中的计数，服务端自己派生', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '别想篡改' })

    const response = await app.request(`/api/posts/${created.id}/like`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Visitor-Id': 'alice' },
      body: JSON.stringify({ likes: 99, liked: true })
    })

    await expect(response.json()).resolves.toMatchObject({ post: { likes: 1, liked: true } })
  })
})

describe('POST /api/posts/:id/favorite', () => {
  const toggleInit = (visitorId) => ({
    method: 'POST',
    headers: visitorId === undefined ? {} : { 'X-Visitor-Id': visitorId }
  })

  it('收藏成功返回 200 与完整访客态 Post', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '收藏我' })

    const response = await app.request(`/api/posts/${created.id}/favorite`, toggleInit('alice'))
    const { post } = await response.json()

    expect(response.status).toBe(200)
    expect(post).toMatchObject({ likes: 0, liked: false, favorites: 1, favorited: true })
  })

  it('再次调用取消收藏', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '取消收藏' })

    await app.request(`/api/posts/${created.id}/favorite`, toggleInit('alice'))
    const { post } = await (await app.request(`/api/posts/${created.id}/favorite`, toggleInit('alice'))).json()

    expect(post).toMatchObject({ favorites: 0, favorited: false })
  })

  it('收藏与点赞互不覆盖', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '两件事都要' })

    await app.request(`/api/posts/${created.id}/like`, toggleInit('alice'))
    const { post } = await (await app.request(`/api/posts/${created.id}/favorite`, toggleInit('alice'))).json()

    expect(post).toMatchObject({ likes: 1, liked: true, favorites: 1, favorited: true })
  })

  it('未命中返回 404 NOT_FOUND', async () => {
    const { app } = setup()
    await expectError(await app.request('/api/posts/missing/favorite', toggleInit('alice')), 404, 'NOT_FOUND')
  })
})

describe('列表 / 详情的访客态', () => {
  it('GET 列表按 X-Visitor-Id 返回不同 liked / favorited', async () => {
    const { app, store } = setup()
    const created = store.create({ content: '列表态' })

    await app.request(`/api/posts/${created.id}/like`, { method: 'POST', headers: { 'X-Visitor-Id': 'alice' } })
    await app.request(`/api/posts/${created.id}/favorite`, { method: 'POST', headers: { 'X-Visitor-Id': 'bob' } })

    const forAlice = await (await app.request('/api/posts', { headers: { 'X-Visitor-Id': 'alice' } })).json()
    const forBob = await (await app.request('/api/posts', { headers: { 'X-Visitor-Id': 'bob' } })).json()
    const anonymous = await (await app.request('/api/posts')).json()

    expect(forAlice.posts[0]).toMatchObject({ likes: 1, liked: true, favorites: 1, favorited: false })
    expect(forBob.posts[0]).toMatchObject({ likes: 1, liked: false, favorites: 1, favorited: true })
    expect(anonymous.posts[0]).toMatchObject({ likes: 1, liked: false, favorites: 1, favorited: false })
  })

  it('新建帖子的响应即带零计数与未激活状态', async () => {
    const { app } = setup()
    const response = await app.request('/api/posts', jsonInit({ content: '全新的' }))

    await expect(response.json()).resolves.toMatchObject({
      post: { likes: 0, favorites: 0, liked: false, favorited: false }
    })
  })
})

describe('兜底路由', () => {
  it('未知路由返回 404 NOT_FOUND', async () => {
    const { app } = setup()
    await expectError(await app.request('/api/unknown'), 404, 'NOT_FOUND')
    await expectError(await app.request('/'), 404, 'NOT_FOUND')
  })

  it('不支持的方法返回 404 NOT_FOUND', async () => {
    const { app } = setup()
    await expectError(await app.request('/api/posts', { method: 'PUT' }), 404, 'NOT_FOUND')
    await expectError(await app.request('/api/health', { method: 'POST' }), 404, 'NOT_FOUND')
  })
})
