// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { createPostStore, CHANNELS, MAX_CONTENT_LENGTH } from '../../server/store.js'

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
      channel: 'night'
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
