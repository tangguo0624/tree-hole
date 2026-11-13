import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import App from '../../src/App.vue'
import { usePostsStore } from '../../src/stores/posts'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

function mountApp() {
  return mount(App, { global: { plugins: [createPinia()] } })
}

describe('App 集成', () => {
  it('渲染品牌区、频道栏与空状态', () => {
    const wrapper = mountApp()
    expect(wrapper.find('.hero__title').text()).toBe('树洞')
    expect(wrapper.find('.hero__subtitle').text()).toBe('把心事交给安静的风')
    expect(wrapper.findAll('.feedbar__tab').length).toBe(4)
    expect(wrapper.find('#emptyState').isVisible()).toBe(true)
    expect(wrapper.find('#emptyTitle').text()).toBe('这里还很安静')
    expect(wrapper.find('#voiceCount').text()).toBe('0')
  })

  it('发布后卡片出现在列表顶部，计数更新', async () => {
    const wrapper = mountApp()
    const store = usePostsStore()

    store.publish('集成测试第一条')
    store.publish('集成测试第二条')
    await nextTick()

    const cards = wrapper.findAll('.post')
    expect(cards.length).toBe(2)
    expect(cards[0].find('.post__content').text()).toBe('集成测试第二条')
    expect(wrapper.find('#voiceCount').text()).toBe('2')
    expect(wrapper.find('#emptyState').isVisible()).toBe(false)
  })

  it('切换到无内容的频道时展示“角落为空”文案', async () => {
    const wrapper = mountApp()
    const store = usePostsStore()

    store.setComposerChannel('shade')
    store.publish('只在树荫')
    store.setChannel('breeze')
    await nextTick()

    expect(wrapper.find('#emptyState').isVisible()).toBe(true)
    expect(wrapper.find('#emptyTitle').text()).toBe('这个角落还很安静')
    expect(wrapper.findAll('.post').length).toBe(0)
  })

  it('持久化：重新挂载（模拟刷新）后数据仍在', async () => {
    const store = usePostsStore()
    store.setComposerChannel('night')
    store.publish('刷新后还在')

    const fresh = mountApp()
    const freshStore = usePostsStore()
    freshStore.load()
    await nextTick()

    expect(fresh.findAll('.post').length).toBe(1)
    expect(fresh.find('.post__content').text()).toBe('刷新后还在')
    expect(fresh.find('.post__channel').text()).toBe('深夜')
  })
})
