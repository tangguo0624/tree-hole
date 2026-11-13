import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePostsStore, CHANNELS, DEFAULT_CHANNEL, MAX_LENGTH, STORAGE_KEY } from '../../src/stores/posts'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('常量', () => {
  it('频道定义完整且默认频道合法', () => {
    expect(CHANNELS.map((c) => c.id)).toEqual(['shade', 'night', 'breeze'])
    expect(CHANNELS.find((c) => c.id === DEFAULT_CHANNEL)).toBeTruthy()
    expect(MAX_LENGTH).toBe(300)
  })
})

describe('load', () => {
  it('无历史数据时得到空列表', () => {
    const store = usePostsStore()
    store.load()
    expect(store.posts).toEqual([])
    expect(store.totalCount).toBe(0)
  })

  it('读取并按时间倒序排列', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'a', content: '早', createdAt: 1000, channel: 'shade' },
      { id: 'b', content: '晚', createdAt: 9000, channel: 'night' }
    ]))
    const store = usePostsStore()
    store.load()
    expect(store.posts.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('旧数据缺 channel 字段时归入默认频道', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'a', content: '旧数据', createdAt: 1000 }
    ]))
    const store = usePostsStore()
    store.load()
    expect(store.posts[0].channel).toBe(DEFAULT_CHANNEL)
  })

  it('数据损坏时降级为空列表且不抛错', () => {
    localStorage.setItem(STORAGE_KEY, '{broken json')
    const store = usePostsStore()
    expect(() => store.load()).not.toThrow()
    expect(store.posts).toEqual([])
  })

  it('非数组数据同样降级为空列表', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nope: true }))
    const store = usePostsStore()
    store.load()
    expect(store.posts).toEqual([])
  })

  it('剔除缺字段的脏数据', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'a', content: '好数据', createdAt: 1000, channel: 'shade' },
      { content: '没有时间' },
      '完全不是对象',
      { id: 'c', content: '   ', createdAt: 3000, channel: 'shade' }
    ]))
    const store = usePostsStore()
    store.load()
    expect(store.posts.length).toBe(1)
    expect(store.posts[0].id).toBe('a')
  })
})

describe('publish', () => {
  it('空内容与纯空白拒绝发布并返回 false', () => {
    const store = usePostsStore()
    expect(store.publish('')).toBe(false)
    expect(store.publish('   \n\t ')).toBe(false)
    expect(store.posts).toEqual([])
  })

  it('发布成功：插入头部、写入存储、返回 true', () => {
    const store = usePostsStore()
    store.publish('第一条')
    store.publish('第二条')
    expect(store.posts.map((p) => p.content)).toEqual(['第二条', '第一条'])
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(saved.map((p) => p.content)).toEqual(['第二条', '第一条'])
    expect(saved[0].id).toBeTruthy()
    expect(saved[0].createdAt).toBeTypeOf('number')
  })

  it('发布内容去除首尾空白并截断到上限', () => {
    const store = usePostsStore()
    store.publish('  你好树洞  ')
    expect(store.posts[0].content).toBe('你好树洞')

    store.publish('x'.repeat(MAX_LENGTH + 50))
    expect(store.posts[0].content.length).toBe(MAX_LENGTH)
  })

  it('按当前选择的投向频道发布', () => {
    const store = usePostsStore()
    store.setComposerChannel('night')
    store.publish('深夜的话')
    expect(store.posts[0].channel).toBe('night')
    expect(store.channelLabel(store.posts[0].channel)).toBe('深夜')
  })

  it('存储写入失败时内容仍在内存中并标记 storageBroken', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const store = usePostsStore()
    expect(store.publish('隐私模式的一条')).toBe(true)
    expect(store.posts[0].content).toBe('隐私模式的一条')
    expect(store.storageBroken).toBe(true)
  })
})

describe('频道过滤', () => {
  it('全部频道显示所有内容', () => {
    const store = usePostsStore()
    store.setComposerChannel('shade'); store.publish('白天')
    store.setComposerChannel('night'); store.publish('黑夜')
    store.setChannel('all')
    expect(store.activeChannel).toBe('all')
    expect(store.visiblePosts.length).toBe(2)
    expect(store.channelCount).toBe(2)
  })

  it('切换频道只显示对应内容', () => {
    const store = usePostsStore()
    store.setComposerChannel('shade'); store.publish('白天')
    store.setComposerChannel('night'); store.publish('黑夜')
    store.setChannel('night')
    expect(store.visiblePosts.map((p) => p.content)).toEqual(['黑夜'])
    expect(store.channelCount).toBe(1)
  })

  it('hasChannelContent 判断频道是否有内容', () => {
    const store = usePostsStore()
    store.setComposerChannel('shade'); store.publish('白天')
    expect(store.hasChannelContent('shade')).toBe(true)
    expect(store.hasChannelContent('breeze')).toBe(false)
  })
})
