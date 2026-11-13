// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPostStore,
  normalizeVisitorId,
  CHANNELS,
  DEFAULT_VISITOR,
  MAX_CONTENT_LENGTH
} from '../../server/store.js'

/** 构造带确定性 now / idFactory 的 store */
function makeStore(options = {}) {
  let tick = 0
  let idTick = 0
  const nows = [...(options.nows ?? [])]
  const ids = [...(options.ids ?? [])]

  return createPostStore({
    now: () => {
      if (nows.length) return nows.shift()
      tick += 1
      return 1_700_000_000_000 + tick
    },
    idFactory: () => {
      if (ids.length) return ids.shift()
      idTick += 1
      return `id-${idTick}`
    }
  })
}

describe('createPostStore', () => {
  let store

  beforeEach(() => {
    store = makeStore()
  })

  it('导出频道常量与长度上限', () => {
    expect(CHANNELS).toEqual(['shade', 'night', 'breeze'])
    expect(MAX_CONTENT_LENGTH).toBe(300)
  })

  it('初始列表为空', () => {
    expect(store.list()).toEqual([])
    expect(store.list({ channel: 'all' })).toEqual([])
    expect(store.list({ channel: 'night' })).toEqual([])
  })

  it('create 使用注入的 idFactory 与 now，并返回完整 Post', () => {
    const created = store.create({ content: '第一句', channel: 'night' })

    expect(created).toEqual({
      id: 'id-1',
      content: '第一句',
      createdAt: 1_700_000_000_001,
      channel: 'night',
      likes: 0,
      favorites: 0,
      liked: false,
      favorited: false
    })
    expect(store.get('id-1')).toEqual(created)
  })

  it('create 省略 channel 时默认 shade', () => {
    const created = store.create({ content: '没写频道' })
    expect(created.channel).toBe('shade')
  })

  it('列表按 createdAt 倒序', () => {
    store.create({ content: 'old', channel: 'shade' })
    store.create({ content: 'new', channel: 'shade' })

    expect(store.list().map((post) => post.content)).toEqual(['new', 'old'])
  })

  it('createdAt 相同时，后插入的排在前', () => {
    const fixed = makeStore({ nows: [5_000, 5_000, 5_000] })
    fixed.create({ content: 'a' })
    fixed.create({ content: 'b' })
    fixed.create({ content: 'c' })

    expect(fixed.list().map((post) => post.content)).toEqual(['c', 'b', 'a'])
  })

  it('按频道过滤，all 返回全部', () => {
    store.create({ content: 's1', channel: 'shade' })
    store.create({ content: 'n1', channel: 'night' })
    store.create({ content: 'b1', channel: 'breeze' })

    expect(store.list({ channel: 'shade' }).map((post) => post.content)).toEqual(['s1'])
    expect(store.list({ channel: 'night' }).map((post) => post.content)).toEqual(['n1'])
    expect(store.list({ channel: 'breeze' }).map((post) => post.content)).toEqual(['b1'])
    expect(store.list({ channel: 'all' })).toHaveLength(3)
  })

  it('get 未命中返回 undefined', () => {
    expect(store.get('missing')).toBeUndefined()
    expect(store.get()).toBeUndefined()
  })

  it('remove 删除命中条目并返回 true，未命中返回 false', () => {
    const created = store.create({ content: '待删除' })

    expect(store.remove(created.id)).toBe(true)
    expect(store.get(created.id)).toBeUndefined()
    expect(store.remove(created.id)).toBe(false)
  })

  it('reset 清空全部并重置排序序号', () => {
    store.create({ content: 'a' })
    store.create({ content: 'b' })
    store.reset()

    expect(store.list()).toEqual([])

    const fixed = makeStore({ nows: [9_000] })
    fixed.create({ content: 'a' })
    fixed.reset()
    fixed.create({ content: 'b' })
    expect(fixed.list().map((post) => post.content)).toEqual(['b'])
  })

  it('不同 store 实例互相隔离（无全局可变单例）', () => {
    const other = makeStore()
    store.create({ content: '只属于第一个' })

    expect(store.list()).toHaveLength(1)
    expect(other.list()).toEqual([])
  })

  it('list/get 返回副本，外部修改不会污染内部存储', () => {
    const created = store.create({ content: '原始' })

    created.content = '被改掉'
    store.list()[0].content = '被改掉'
    store.get(created.id).content = '被改掉'

    expect(store.get(created.id).content).toBe('原始')
  })
})

describe('normalizeVisitorId', () => {
  it('导出默认访客常量', () => {
    expect(DEFAULT_VISITOR).toBe('anonymous')
  })

  it('去首尾空白，长度 1–64 视为有效', () => {
    expect(normalizeVisitorId('  alice  ')).toBe('alice')
    expect(normalizeVisitorId('a')).toBe('a')
    expect(normalizeVisitorId('a'.repeat(64))).toBe('a'.repeat(64))
  })

  it('缺失 / 空白 / 超长 / 非字符串一律归一为 anonymous', () => {
    expect(normalizeVisitorId()).toBe('anonymous')
    expect(normalizeVisitorId(undefined)).toBe('anonymous')
    expect(normalizeVisitorId(null)).toBe('anonymous')
    expect(normalizeVisitorId('')).toBe('anonymous')
    expect(normalizeVisitorId('   \t\n ')).toBe('anonymous')
    expect(normalizeVisitorId('a'.repeat(65))).toBe('anonymous')
    expect(normalizeVisitorId(42)).toBe('anonymous')
    expect(normalizeVisitorId({ id: 'x' })).toBe('anonymous')
  })
})

describe('点赞 / 收藏（访客态）', () => {
  let store
  let postId

  beforeEach(() => {
    store = makeStore()
    postId = store.create({ content: '可互动的树洞', channel: 'shade' }).id
  })

  it('toggleLike 第一次点赞，第二次取消，回到原值', () => {
    const liked = store.toggleLike(postId, 'alice')
    expect(liked).toMatchObject({ likes: 1, liked: true })

    const unliked = store.toggleLike(postId, 'alice')
    expect(unliked).toMatchObject({ likes: 0, liked: false })
  })

  it('toggleFavorite 与点赞互相独立', () => {
    store.toggleLike(postId, 'alice')
    const favorited = store.toggleFavorite(postId, 'alice')

    expect(favorited).toMatchObject({ likes: 1, liked: true, favorites: 1, favorited: true })

    const unliked = store.toggleLike(postId, 'alice')
    expect(unliked).toMatchObject({ likes: 0, liked: false, favorites: 1, favorited: true })
  })

  it('不同访客的点赞 / 收藏互不影响', () => {
    store.toggleLike(postId, 'alice')
    store.toggleFavorite(postId, 'bob')

    expect(store.get(postId, 'alice')).toMatchObject({ likes: 1, liked: true, favorites: 1, favorited: false })
    expect(store.get(postId, 'bob')).toMatchObject({ likes: 1, liked: false, favorites: 1, favorited: true })
    expect(store.get(postId, 'carol')).toMatchObject({ likes: 1, liked: false, favorites: 1, favorited: false })
  })

  it('缺失 visitorId 归一为 anonymous，与显式 anonymous 共享状态', () => {
    store.toggleLike(postId)
    expect(store.get(postId).liked).toBe(true)
    expect(store.get(postId, DEFAULT_VISITOR).liked).toBe(true)

    const again = store.toggleLike(postId, DEFAULT_VISITOR)
    expect(again).toMatchObject({ likes: 0, liked: false })
  })

  it('visitorId 首尾空白被归一，同一个访客不会重复计数', () => {
    store.toggleLike(postId, '  alice  ')
    const again = store.toggleLike(postId, 'alice')

    expect(again).toMatchObject({ likes: 0, liked: false })
  })

  it('toggle 未命中返回 undefined 且不产生幽灵条目', () => {
    expect(store.toggleLike('missing', 'alice')).toBeUndefined()
    expect(store.toggleFavorite('missing', 'alice')).toBeUndefined()
    expect(store.list()).toHaveLength(1)
  })

  it('计数不为负：重复取消后仍为 0，未知访客取消也不会变负', () => {
    store.toggleLike(postId, 'alice')
    store.toggleLike(postId, 'alice')
    store.toggleFavorite(postId, 'ghost')
    store.toggleFavorite(postId, 'ghost')

    expect(store.get(postId, 'alice')).toMatchObject({ likes: 0, favorites: 0 })
  })

  it('list 按访客返回不同的 liked / favorited', () => {
    store.toggleLike(postId, 'alice')

    expect(store.list({ visitorId: 'alice' })[0]).toMatchObject({ likes: 1, liked: true })
    expect(store.list({ visitorId: 'bob' })[0]).toMatchObject({ likes: 1, liked: false })
    expect(store.list({ channel: 'shade', visitorId: 'bob' })[0].liked).toBe(false)
    expect(store.list()[0].liked).toBe(false)
  })

  it('返回的是副本：外部改计数不会污染内部 Set', () => {
    const liked = store.toggleLike(postId, 'alice')
    liked.likes = 999
    liked.liked = false

    expect(store.get(postId, 'alice')).toMatchObject({ likes: 1, liked: true })
  })

  it('remove 后重建同 id 的帖子，访客集合已随条目丢弃', () => {
    const recycled = makeStore({ ids: ['same-id', 'same-id'] })
    recycled.create({ content: '第一世' })
    recycled.toggleLike('same-id', 'alice')

    expect(recycled.remove('same-id')).toBe(true)

    const reborn = recycled.create({ content: '第二世' })
    expect(reborn).toMatchObject({ id: 'same-id', likes: 0, favorites: 0, liked: false, favorited: false })
    expect(recycled.get('same-id', 'alice')).toMatchObject({ likes: 0, liked: false })
  })

  it('reset 后访客集合一并清空', () => {
    store.toggleLike(postId, 'alice')
    store.reset()
    store.create({ content: '新的一页' })

    expect(store.list({ visitorId: 'alice' })[0]).toMatchObject({ likes: 0, liked: false })
  })
})
