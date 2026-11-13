import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Composer from '../../src/components/Composer.vue'
import { usePostsStore } from '../../src/stores/posts'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('Composer 组件', () => {
  it('初始渲染：计数 0 / 300，按钮禁用，含三个投向频道', () => {
    const wrapper = mount(Composer)
    expect(wrapper.find('#charCount').text()).toBe('0 / 300')
    expect(wrapper.find('#submitBtn').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.chip').length).toBe(3)
    expect(wrapper.findAll('.chip')[0].classes()).toContain('is-active')
  })

  it('输入内容后按钮可用；纯空白仍然禁用并实时计数', async () => {
    const wrapper = mount(Composer)
    await wrapper.find('#postContent').setValue('你好，树洞')
    expect(wrapper.find('#submitBtn').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('#charCount').text()).toBe('5 / 300')

    await wrapper.find('#postContent').setValue('   ')
    expect(wrapper.find('#submitBtn').attributes('disabled')).toBeDefined()
    expect(wrapper.find('#charCount').text()).toBe('3 / 300')
  })

  it('接近上限时计数进入警示样式', async () => {
    const wrapper = mount(Composer)
    await wrapper.find('#postContent').setValue('字'.repeat(280))
    expect(wrapper.find('#charCount').classes()).toContain('is-warn')
  })

  it('提交表单：写入 store、持久化、清空输入', async () => {
    const wrapper = mount(Composer)
    const store = usePostsStore()

    await wrapper.find('#postContent').setValue('  第一条心声  ')
    await wrapper.find('form').trigger('submit')

    expect(store.posts.length).toBe(1)
    expect(store.posts[0].content).toBe('第一条心声')
    expect(wrapper.find('#postContent').element.value).toBe('')
    expect(wrapper.find('#charCount').text()).toBe('0 / 300')
    expect(JSON.parse(localStorage.getItem('treehole.posts.v1')).length).toBe(1)
  })

  it('空内容提交不产生数据', async () => {
    const wrapper = mount(Composer)
    await wrapper.find('#postContent').setValue('   ')
    await wrapper.find('form').trigger('submit')
    expect(usePostsStore().posts).toEqual([])
  })

  it('点击频道胶囊切换投向', async () => {
    const wrapper = mount(Composer)
    const store = usePostsStore()

    const chips = wrapper.findAll('.chip')
    await chips[1].trigger('click')

    expect(store.composerChannel).toBe('night')
    expect(chips[1].classes()).toContain('is-active')
    expect(chips[0].classes()).not.toContain('is-active')

    await wrapper.find('#postContent').setValue('深夜的一条')
    await wrapper.find('form').trigger('submit')
    expect(store.posts[0].channel).toBe('night')
  })
})
