import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PostList from '../../src/components/PostList.vue'
import { usePostsStore } from '../../src/stores/posts'
import { createFakeBackend } from '../helpers/fakeBackend'

let backend

beforeEach(() => {
  setActivePinia(createPinia())
  backend = createFakeBackend()
  vi.stubGlobal('fetch', vi.fn(backend.fetchImpl))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function seed(posts) {
  backend.db.push(...posts)
}

describe('PostList 收藏筛选', () => {
  it('标题栏右侧渲染「只看收藏 · N」，默认未激活', async () => {
    seed([
      { id: 'a', content: '收藏了', createdAt: 2000, channel: 'shade', favorites: 1, favorited: true },
      { id: 'b', content: '没收藏', createdAt: 1000, channel: 'night' }
    ])
    const store = usePostsStore()
    await store.load()

    const wrapper = mount(PostList)
    await flushPromises()

    const toggle = wrapper.find('.favorites-toggle')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toBe('只看收藏 · 1')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(toggle.classes()).not.toContain('is-active')
  })

  it('点击后开启筛选：只留下已收藏，按钮进入激活态', async () => {
    seed([
      { id: 'a', content: '收藏了', createdAt: 2000, channel: 'shade', favorited: true, favorites: 1 },
      { id: 'b', content: '没收藏', createdAt: 1000, channel: 'shade' }
    ])
    const store = usePostsStore()
    await store.load()

    const wrapper = mount(PostList)
    await wrapper.find('.favorites-toggle').trigger('click')

    expect(store.favoritesOnly).toBe(true)
    expect(wrapper.find('.favorites-toggle').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.favorites-toggle').classes()).toContain('is-active')
    expect(wrapper.findAll('.post').length).toBe(1)
    expect(wrapper.find('.post__content').text()).toBe('收藏了')
  })

  it('再点一次关闭筛选，恢复全部内容', async () => {
    seed([
      { id: 'a', content: '收藏了', createdAt: 2000, channel: 'shade', favorited: true },
      { id: 'b', content: '没收藏', createdAt: 1000, channel: 'shade' }
    ])
    const store = usePostsStore()
    await store.load()

    const wrapper = mount(PostList)
    await wrapper.find('.favorites-toggle').trigger('click')
    await wrapper.find('.favorites-toggle').trigger('click')

    expect(store.favoritesOnly).toBe(false)
    expect(wrapper.findAll('.post').length).toBe(2)
  })

  it('筛选后为空时提示「还没有收藏」，而不是频道为空', async () => {
    seed([{ id: 'a', content: '没收藏', createdAt: 1000, channel: 'shade' }])
    const store = usePostsStore()
    await store.load()

    const wrapper = mount(PostList)
    await wrapper.find('.favorites-toggle').trigger('click')

    expect(wrapper.find('#emptyState').isVisible()).toBe(true)
    expect(wrapper.find('#emptyTitle').text()).toBe('还没有收藏')
    expect(wrapper.find('#emptyDesc').text()).toContain('收藏')
  })

  it('未开启筛选时频道为空仍沿用「这个角落还很安静」', async () => {
    seed([{ id: 'a', content: '只在树荫', createdAt: 1000, channel: 'shade' }])
    const store = usePostsStore()
    await store.load()
    store.setChannel('breeze')

    const wrapper = mount(PostList)

    expect(wrapper.find('#emptyTitle').text()).toBe('这个角落还很安静')
  })

  it('卡片上的点赞按钮接到 store action，并乐观更新计数', async () => {
    seed([{ id: 'a', content: '想被看见', createdAt: 1000, channel: 'shade', likes: 2 }])
    const store = usePostsStore()
    await store.load()

    const wrapper = mount(PostList)
    await wrapper.find('.post__action--like').trigger('click')

    // 乐观更新先落库
    expect(wrapper.find('.post__action--like').classes()).toContain('is-active')
    expect(wrapper.find('.post__action--like .post__action-count').text()).toBe('3')

    await flushPromises()

    const toggleCall = backend.calls.find((call) => call.url === '/api/posts/a/like')
    expect(toggleCall).toBeTruthy()
    expect(toggleCall.method).toBe('POST')
    expect(store.posts[0].likes).toBe(3)
    expect(store.posts[0].liked).toBe(true)
  })

  it('卡片上的收藏按钮更新收藏数，「只看收藏 · N」随之变化', async () => {
    seed([{ id: 'a', content: '想被收藏', createdAt: 1000, channel: 'shade' }])
    const store = usePostsStore()
    await store.load()

    const wrapper = mount(PostList)
    await wrapper.find('.post__action--favorite').trigger('click')
    await flushPromises()

    expect(wrapper.find('.favorites-toggle').text()).toBe('只看收藏 · 1')
    expect(store.favoriteCount).toBe(1)
  })
})
