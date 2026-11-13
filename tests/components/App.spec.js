import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '../../src/App.vue'
import { usePostsStore } from '../../src/stores/posts'
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

function mountApp() {
  return mount(App, { global: { plugins: [createPinia()] } })
}

describe('App 集成', () => {
  it('挂载时从 API 拉数据，渲染品牌区、频道栏与空状态', async () => {
    const wrapper = mountApp()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/posts')
    expect(wrapper.find('.hero__title').text()).toBe('树洞')
    expect(wrapper.find('.hero__subtitle').text()).toBe('把心事交给安静的风')
    expect(wrapper.findAll('.feedbar__tab').length).toBe(4)
    expect(wrapper.find('#emptyState').isVisible()).toBe(true)
    expect(wrapper.find('#emptyTitle').text()).toBe('这里还很安静')
    expect(wrapper.find('#voiceCount').text()).toBe('0')
  })

  it('页面文案不再声称数据只存在本地', async () => {
    const wrapper = mountApp()
    await flushPromises()

    const html = wrapper.html()
    expect(html).not.toContain('LocalStorage')
    expect(html).not.toContain('仅保存在此设备')
    expect(wrapper.find('.site-footer').text()).toContain('树洞的小屋')
  })

  it('后端已有数据时按最新在前渲染', async () => {
    backend.db.push(
      { id: 'old', content: '早一点的', createdAt: Date.now() - 60000, channel: 'shade' },
      { id: 'new', content: '刚说的', createdAt: Date.now(), channel: 'night' }
    )

    const wrapper = mountApp()
    await flushPromises()

    const cards = wrapper.findAll('.post')
    expect(cards.length).toBe(2)
    expect(cards[0].find('.post__content').text()).toBe('刚说的')
    expect(wrapper.find('#voiceCount').text()).toBe('2')
    expect(wrapper.find('#emptyState').isVisible()).toBe(false)
  })

  it('发布后卡片出现在列表顶部，计数更新', async () => {
    const wrapper = mountApp()
    const store = usePostsStore()
    await flushPromises()

    await store.publish('集成测试第一条')
    await store.publish('集成测试第二条')
    await flushPromises()

    const cards = wrapper.findAll('.post')
    expect(cards.length).toBe(2)
    expect(cards[0].find('.post__content').text()).toBe('集成测试第二条')
    expect(wrapper.find('#voiceCount').text()).toBe('2')
    expect(wrapper.find('#emptyState').isVisible()).toBe(false)
  })

  it('切换到无内容的频道时展示“角落为空”文案', async () => {
    const wrapper = mountApp()
    const store = usePostsStore()
    await flushPromises()

    store.setComposerChannel('shade')
    await store.publish('只在树荫')
    store.setChannel('breeze')
    await flushPromises()

    expect(wrapper.find('#emptyState').isVisible()).toBe(true)
    expect(wrapper.find('#emptyTitle').text()).toBe('这个角落还很安静')
    expect(wrapper.findAll('.post').length).toBe(0)
  })

  it('加载失败时给出可读错误提示而不是崩溃', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: 'INTERNAL', message: '炸了' } }, 500))

    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.find('#errorState').exists()).toBe(true)
    expect(wrapper.find('#errorState').text()).toContain('稍后再试')
    expect(wrapper.find('#emptyState').isVisible()).toBe(true)
  })

  it('刷新（重新挂载）后从服务端重新拿到数据并仍在', async () => {
    const first = mountApp()
    const store = usePostsStore()
    await flushPromises()

    store.setComposerChannel('night')
    await store.publish('刷新后还在')
    await flushPromises()
    expect(first.findAll('.post').length).toBe(1)
    first.unmount()

    const fresh = mountApp()
    await flushPromises()

    expect(fresh.findAll('.post').length).toBe(1)
    expect(fresh.find('.post__content').text()).toBe('刷新后还在')
    expect(fresh.find('.post__channel').text()).toBe('深夜')
    expect(fresh.find('#voiceCount').text()).toBe('1')
  })
})
