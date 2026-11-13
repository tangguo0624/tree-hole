import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChannelBar from '../../src/components/ChannelBar.vue'
import { usePostsStore } from '../../src/stores/posts'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('ChannelBar 组件', () => {
  it('渲染「全部 + 三个频道」共四个页签，默认选中全部', () => {
    const wrapper = mount(ChannelBar)
    const tabs = wrapper.findAll('.feedbar__tab')
    expect(tabs.length).toBe(4)
    expect(tabs[0].text()).toBe('全部')
    expect(tabs.map((tab) => tab.text())).toEqual(['全部', '树荫', '深夜', '微风'])
    expect(tabs[0].classes()).toContain('is-active')
    expect(tabs[0].attributes('aria-selected')).toBe('true')
  })

  it('点击页签切换 store 的 activeChannel 并更新高亮', async () => {
    const wrapper = mount(ChannelBar)
    const store = usePostsStore()

    await wrapper.findAll('.feedbar__tab')[2].trigger('click')

    expect(store.activeChannel).toBe('night')
    const tabs = wrapper.findAll('.feedbar__tab')
    expect(tabs[2].classes()).toContain('is-active')
    expect(tabs[2].attributes('aria-selected')).toBe('true')
    expect(tabs[0].classes()).not.toContain('is-active')
    expect(tabs[0].attributes('aria-selected')).toBe('false')
  })

  it('实时显示当前频道条数', async () => {
    const wrapper = mount(ChannelBar)
    const store = usePostsStore()

    store.setComposerChannel('shade')
    store.publish('白天的一条')
    store.setComposerChannel('night')
    store.publish('黑夜的一条')
    await Promise.resolve()

    expect(wrapper.find('#feedCount').text()).toBe('2 条')

    await wrapper.findAll('.feedbar__tab')[2].trigger('click')
    expect(wrapper.find('#feedCount').text()).toBe('1 条')
  })
})
