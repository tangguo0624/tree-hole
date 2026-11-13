import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePostsStore, CHANNELS, DEFAULT_CHANNEL, MAX_LENGTH } from '../../src/stores/posts'
import { jsonResponse, createFakeBackend } from '../helpers/fakeBackend'

let fetchMock
let backend

beforeEach(() => {
  setActivePinia(createPinia())
  backend = createFakeBackend()
  fetchMock = vi.fn(backend.fetchImpl)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function post(overrides = {}) {
  return { id: 'a', content: '早', createdAt: 1000, channel: 'shade', ...overrides }
}

function respondPosts(posts, status = 200) {
  fetchMock.mockResolvedValueOnce(jsonResponse({ posts }, status))
}

function failWith(status, code = 'INTERNAL', message = '服务端出错了') {
  fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code, message } }, status))
}

describe('常量', () => {
  it('频道定义完整且默认频道合法', () => {
    expect(CHANNELS.map((c) => c.id)).toEqual(['shade', 'night', 'breeze'])
    expect(CHANNELS.find((c) => c.id === DEFAULT_CHANNEL)).toBeTruthy()
    expect(MAX_LENGTH).toBe(300)
  })

  it('不再导出 localStorage 相关常量', async () => {
    const mod = await import('../../src/stores/posts')
    expect(mod.STORAGE_KEY).toBeUndefined()
    expect(mod.STORAGE_KEY).not.toBeDefined()
  })
})

describe('load', () => {
  it('后端返回空列表时得到空列表', async () => {
    respondPosts([])
    const store = usePostsStore()

    await store.load()

    expect(store.posts).toEqual([])
    expect(store.totalCount).toBe(0)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('按时间倒序排列', async () => {
    respondPosts([post({ id: 'a', createdAt: 1000 }), post({ id: 'b', createdAt: 9000, channel: 'night' })])
    const store = usePostsStore()

    await store.load()

    expect(store.posts.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('旧数据缺 channel 字段时归入默认频道', async () => {
    respondPosts([{ id: 'a', content: '旧数据', createdAt: 1000 }])
    const store = usePostsStore()

    await store.load()

    expect(store.posts[0].channel).toBe(DEFAULT_CHANNEL)
  })

  it('剔除缺字段的脏数据', async () => {
    respondPosts([
      post({ id: 'a', content: '好数据' }),
      { content: '没有时间' },
      '完全不是对象',
      post({ id: 'c', content: '   ' })
    ])
    const store = usePostsStore()

    await store.load()

    expect(store.posts.length).toBe(1)
    expect(store.posts[0].id).toBe('a')
  })

  it('始终拉取全部数据、不带 channel 查询参数，保证全站缓存完整', async () => {
    respondPosts([])
    const store = usePostsStore()

    await store.load()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/posts')
    expect(fetchMock.mock.calls[0][1].method).toBe('GET')
  })

  it('停在某个频道时 load 仍拉全部数据，切换频道后计数正确', async () => {
    respondPosts([post({ id: 'a', channel: 'shade' }), post({ id: 'b', channel: 'night', createdAt: 2000 })])
    const store = usePostsStore()
    store.setChannel('night')

    await store.load()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/posts')
    expect(store.visiblePosts.map((p) => p.id)).toEqual(['b'])
    expect(store.channelCount).toBe(1)

    store.setChannel('all')
    expect(store.totalCount).toBe(2)
    expect(store.channelCount).toBe(2)
  })

  it('后端 5xx 时降级为空列表、给出可读 error 且不抛错', async () => {
    failWith(500)
    const store = usePostsStore()

    await expect(store.load()).resolves.toBeDefined()
    expect(store.posts).toEqual([])
    expect(store.error).toBeTruthy()
    expect(store.error).toContain('稍后再试')
    expect(store.loading).toBe(false)
  })

  it('网络异常时同样降级为空列表且不抛错', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const store = usePostsStore()

    await expect(store.load()).resolves.toBeDefined()
    expect(store.posts).toEqual([])
    expect(store.error).toContain('稍后再试')
  })

  it('重新 load 会覆盖上一次的结果并清除旧 error', async () => {
    failWith(503)
    const store = usePostsStore()
    await store.load()
    expect(store.error).toBeTruthy()

    respondPosts([post({ id: 'fresh' })])
    await store.load()

    expect(store.error).toBeNull()
    expect(store.posts.map((p) => p.id)).toEqual(['fresh'])
  })
})

describe('publish', () => {
  it('空内容与纯空白拒绝发布且不发请求', async () => {
    const store = usePostsStore()

    expect(await store.publish('')).toBe(false)
    expect(await store.publish('   \n\t ')).toBe(false)
    expect(store.posts).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('发布成功：把后端返回的 post 插到头部并返回 true', async () => {
    const store = usePostsStore()

    expect(await store.publish('第一条')).toBe(true)
    expect(await store.publish('第二条')).toBe(true)

    const [firstCall, secondCall] = fetchMock.mock.calls
    expect(firstCall[0]).toBe('/api/posts')
    expect(firstCall[1].method).toBe('POST')
    expect(JSON.parse(firstCall[1].body)).toEqual({ content: '第一条', channel: DEFAULT_CHANNEL })
    expect(JSON.parse(secondCall[1].body).content).toBe('第二条')

    expect(store.posts.map((p) => p.content)).toEqual(['第二条', '第一条'])
    expect(store.posts[0].id).toBe('srv-2')
    expect(store.posts[0].createdAt).toBeTypeOf('number')
    expect(store.error).toBeNull()
  })

  it('发布内容去除首尾空白并截断到上限后再发送', async () => {
    const store = usePostsStore()

    await store.publish('  你好树洞  ')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).content).toBe('你好树洞')

    await store.publish('x'.repeat(MAX_LENGTH + 50))
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body).content
    expect(sent.length).toBe(MAX_LENGTH)
    expect(store.posts[0].content.length).toBe(MAX_LENGTH)
  })

  it('按当前选择的投向频道发布', async () => {
    const store = usePostsStore()
    store.setComposerChannel('night')

    await store.publish('深夜的话')

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).channel).toBe('night')
    expect(store.posts[0].channel).toBe('night')
    expect(store.channelLabel(store.posts[0].channel)).toBe('深夜')
  })

  it('后端 5xx 时返回 false、不插入假数据并给出 error', async () => {
    failWith(500)
    const store = usePostsStore()

    expect(await store.publish('发不出去的一条')).toBe(false)
    expect(store.posts).toEqual([])
    expect(store.error).toContain('稍后再试')
  })

  it('后端 4xx 时同样返回 false 且不插入', async () => {
    failWith(400, 'INVALID_CONTENT', '内容不合法')
    const store = usePostsStore()

    expect(await store.publish('会被拒绝')).toBe(false)
    expect(store.posts).toEqual([])
    expect(store.error).toBeTruthy()
  })

  it('网络异常时返回 false 且不插入', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const store = usePostsStore()

    expect(await store.publish('断网的一条')).toBe(false)
    expect(store.posts).toEqual([])
    expect(store.error).toContain('稍后再试')
  })

  it('发布过程中重复提交只发一次请求', async () => {
    let resolveFetch
    fetchMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveFetch = resolve
    }))
    const store = usePostsStore()

    const first = store.publish('并发第一条')
    expect(store.publishing).toBe(true)
    expect(await store.publish('并发第二条')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch(jsonResponse({ post: { id: 'srv-1', content: '并发第一条', createdAt: 5000, channel: DEFAULT_CHANNEL } }, 201))
    expect(await first).toBe(true)
    expect(store.publishing).toBe(false)
    expect(store.posts.length).toBe(1)
  })
})

describe('频道过滤', () => {
  it('全部频道显示所有内容', async () => {
    const store = usePostsStore()
    store.setComposerChannel('shade'); await store.publish('白天')
    store.setComposerChannel('night'); await store.publish('黑夜')
    store.setChannel('all')

    expect(store.activeChannel).toBe('all')
    expect(store.visiblePosts.length).toBe(2)
    expect(store.channelCount).toBe(2)
  })

  it('切换频道只显示对应内容', async () => {
    const store = usePostsStore()
    store.setComposerChannel('shade'); await store.publish('白天')
    store.setComposerChannel('night'); await store.publish('黑夜')
    store.setChannel('night')

    expect(store.visiblePosts.map((p) => p.content)).toEqual(['黑夜'])
    expect(store.channelCount).toBe(1)
  })

  it('hasChannelContent 判断频道是否有内容', async () => {
    const store = usePostsStore()
    store.setComposerChannel('shade'); await store.publish('白天')

    expect(store.hasChannelContent('shade')).toBe(true)
    expect(store.hasChannelContent('breeze')).toBe(false)
  })

  it('isTotallyEmpty 区分“全站空”与“当前频道空”', async () => {
    const store = usePostsStore()
    expect(store.isTotallyEmpty).toBe(true)

    store.setComposerChannel('shade'); await store.publish('白天')
    store.setChannel('breeze')

    expect(store.visiblePosts).toEqual([])
    expect(store.isTotallyEmpty).toBe(false)
  })
})

describe('计数与访客态归一化', () => {
  it('保留后端给出的计数与访客态', async () => {
    respondPosts([post({ id: 'a', likes: 3, favorites: 1, liked: true, favorited: true })])
    const store = usePostsStore()

    await store.load()

    expect(store.posts[0]).toMatchObject({ likes: 3, favorites: 1, liked: true, favorited: true })
  })

  it('缺字段时补齐为 0 / false', async () => {
    respondPosts([post({ id: 'a' })])
    const store = usePostsStore()

    await store.load()

    expect(store.posts[0]).toMatchObject({ likes: 0, favorites: 0, liked: false, favorited: false })
  })

  it('负数、非数字、字符串布尔等脏值一律回退到安全值', async () => {
    respondPosts([
      post({ id: 'a', likes: -5, favorites: '很多', liked: 'yes', favorited: 1 }),
      post({ id: 'b', likes: 2.7, favorites: '4', liked: 0, favorited: null })
    ])
    const store = usePostsStore()

    await store.load()

    const [first, second] = store.posts
    expect(first).toMatchObject({ likes: 0, favorites: 0, liked: false, favorited: false })
    expect(second.likes).toBe(2)
    expect(second.favorites).toBe(4)
    expect(second.liked).toBe(false)
    expect(second.favorited).toBe(false)
  })
})

describe('favoritesOnly 与 favoriteCount', () => {
  beforeEach(respondPostsForFavorites)

  /** 两条收藏散落在不同频道，用来验证「频道 + 收藏」叠加过滤 */
  function respondPostsForFavorites() {
    respondPosts([
      post({ id: 'a', channel: 'shade', favorited: true, favorites: 2, createdAt: 3000 }),
      post({ id: 'b', channel: 'night', favorited: true, favorites: 1, createdAt: 2000 }),
      post({ id: 'c', channel: 'shade', favorited: false, createdAt: 1000 })
    ])
  }

  it('favoriteCount 统计全部收藏（不受频道影响）', async () => {
    const store = usePostsStore()
    await store.load()
    store.setChannel('night')

    expect(store.favoriteCount).toBe(2)
  })

  it('开启后只保留已收藏，且仍受当前频道约束', async () => {
    const store = usePostsStore()
    await store.load()
    store.setFavoritesOnly(true)

    expect(store.visiblePosts.map((p) => p.id)).toEqual(['a', 'b'])

    store.setChannel('shade')
    expect(store.visiblePosts.map((p) => p.id)).toEqual(['a'])
  })

  it('默认关闭，setFavoritesOnly / toggleFavoritesOnly 可切换', async () => {
    const store = usePostsStore()
    await store.load()

    expect(store.favoritesOnly).toBe(false)

    store.setFavoritesOnly(true)
    expect(store.favoritesOnly).toBe(true)
    store.setFavoritesOnly(false)
    expect(store.favoritesOnly).toBe(false)

    store.toggleFavoritesOnly()
    expect(store.favoritesOnly).toBe(true)
    store.toggleFavoritesOnly()
    expect(store.favoritesOnly).toBe(false)
  })
})

describe('toggleLike', () => {
  async function loadOne(overrides = {}) {
    respondPosts([post({ id: 'a', likes: 1, favorites: 0, liked: false, favorited: false, ...overrides })])
    const store = usePostsStore()
    await store.load()
    return store
  }

  it('乐观更新：请求返回前就已点赞并 +1，返回后采用服务端计数', async () => {
    const store = await loadOne()
    let resolveFetch
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve }))

    const pending = store.toggleLike('a')

    expect(store.posts[0].liked).toBe(true)
    expect(store.posts[0].likes).toBe(2)

    resolveFetch(jsonResponse({ post: post({ id: 'a', likes: 9, liked: true }) }))
    expect(await pending).toBe(true)

    expect(store.posts[0].likes).toBe(9)
    expect(store.posts[0].liked).toBe(true)
    expect(store.error).toBeNull()
  })

  it('已有的点赞可以取消，计数同步减 1', async () => {
    const store = await loadOne({ likes: 5, liked: true })
    let resolveFetch
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve }))

    const pending = store.toggleLike('a')
    expect(store.posts[0].liked).toBe(false)
    expect(store.posts[0].likes).toBe(4)

    resolveFetch(jsonResponse({ post: post({ id: 'a', likes: 4, liked: false }) }))
    await pending

    expect(store.posts[0].liked).toBe(false)
    expect(store.posts[0].likes).toBe(4)
  })

  it('网络失败：回滚到原值并写中文 error', async () => {
    const store = await loadOne({ likes: 5 })
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    expect(await store.toggleLike('a')).toBe(false)

    expect(store.posts[0].liked).toBe(false)
    expect(store.posts[0].likes).toBe(5)
    expect(store.error).toContain('稍后再试')
  })

  it('404 失败：同样回滚，error 提示可重试', async () => {
    const store = await loadOne({ likes: 5, liked: true })
    failWith(404, 'NOT_FOUND', '这条声音不在了')

    expect(await store.toggleLike('a')).toBe(false)

    expect(store.posts[0].liked).toBe(true)
    expect(store.posts[0].likes).toBe(5)
    expect(store.error).toBeTruthy()
    expect(store.error).toContain('稍后再试')
  })

  it('同一帖子请求进行中忽略重复点击，只发一次请求', async () => {
    const store = await loadOne()
    let resolveFetch
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve }))

    const first = store.toggleLike('a')
    expect(await store.toggleLike('a')).toBe(false)
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/posts/a/like').length).toBe(1)

    resolveFetch(jsonResponse({ post: post({ id: 'a', likes: 2, liked: true }) }))
    expect(await first).toBe(true)
    expect(store.posts[0].likes).toBe(2)
  })

  it('帖子不存在时直接返回 false，不发请求', async () => {
    const store = await loadOne()
    const before = fetchMock.mock.calls.length

    expect(await store.toggleLike('nope')).toBe(false)
    expect(fetchMock.mock.calls.length).toBe(before)
  })
})

describe('toggleFavorite', () => {
  async function loadOne(overrides = {}) {
    respondPosts([post({ id: 'a', likes: 0, favorites: 1, liked: false, favorited: false, ...overrides })])
    const store = usePostsStore()
    await store.load()
    return store
  }

  it('乐观更新收藏态与计数，并让 favoriteCount 立即可见', async () => {
    const store = await loadOne()
    let resolveFetch
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve }))

    const pending = store.toggleFavorite('a')

    expect(store.posts[0].favorited).toBe(true)
    expect(store.posts[0].favorites).toBe(2)
    expect(store.favoriteCount).toBe(1)

    resolveFetch(jsonResponse({ post: post({ id: 'a', favorites: 2, favorited: true }) }))
    expect(await pending).toBe(true)

    expect(store.posts[0].favorited).toBe(true)
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/posts/a/favorite').length).toBe(1)
  })

  it('失败回滚收藏态与计数', async () => {
    const store = await loadOne({ favorited: true, favorites: 3 })
    failWith(500)

    expect(await store.toggleFavorite('a')).toBe(false)

    expect(store.posts[0].favorited).toBe(true)
    expect(store.posts[0].favorites).toBe(3)
    expect(store.error).toBeTruthy()
    expect(store.favoriteCount).toBe(1)
  })

  it('取消收藏后从「只看收藏」中消失', async () => {
    const store = await loadOne({ favorited: true, favorites: 2 })
    store.setFavoritesOnly(true)
    expect(store.visiblePosts.map((p) => p.id)).toEqual(['a'])

    fetchMock.mockResolvedValueOnce(jsonResponse({ post: post({ id: 'a', favorites: 1, favorited: false }) }))
    await store.toggleFavorite('a')

    expect(store.favoritesOnly).toBe(true)
    expect(store.visiblePosts).toEqual([])
  })
})
