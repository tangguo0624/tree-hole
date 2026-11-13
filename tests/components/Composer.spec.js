import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Composer from '../../src/components/Composer.vue'
import { usePostsStore } from '../../src/stores/posts'
import { useToastStore } from '../../src/stores/toast'
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

  it('提交表单：请求后端、写入 store、清空输入并提示成功', async () => {
    const wrapper = mount(Composer)
    const store = usePostsStore()
    const toast = useToastStore()

    await wrapper.find('#postContent').setValue('  第一条心声  ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ content: '第一条心声', channel: 'shade' })
    expect(store.posts.length).toBe(1)
    expect(store.posts[0].content).toBe('第一条心声')
    expect(wrapper.find('#postContent').element.value).toBe('')
    expect(wrapper.find('#charCount').text()).toBe('0 / 300')
    expect(toast.message).toBe('已投进树洞，叶子替你说完了')
  })

  it('空内容提交不产生任何请求', async () => {
    const wrapper = mount(Composer)
    await wrapper.find('#postContent').setValue('   ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(usePostsStore().posts).toEqual([])
  })

  it('后端失败时保留草稿并提示保存失败', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: 'INTERNAL', message: '炸了' } }, 500))
    const wrapper = mount(Composer)
    const store = usePostsStore()
    const toast = useToastStore()

    await wrapper.find('#postContent').setValue('发不出去的一条')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(store.posts).toEqual([])
    expect(wrapper.find('#postContent').element.value).toBe('发不出去的一条')
    expect(toast.message).toBe('保存失败，请稍后再试')
    expect(wrapper.find('#submitBtn').attributes('disabled')).toBeUndefined()
  })

  it('提交期间按钮禁用，防止重复提交', async () => {
    let resolveFetch
    fetchMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveFetch = resolve
    }))
    const wrapper = mount(Composer)

    await wrapper.find('#postContent').setValue('等一等')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#submitBtn').attributes('disabled')).toBeDefined()

    resolveFetch(jsonResponse({ post: { id: 'srv-1', content: '等一等', createdAt: Date.now(), channel: 'shade' } }, 201))
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('#submitBtn').attributes('disabled')).toBeDefined()
    expect(usePostsStore().posts.length).toBe(1)
  })

  it('Ctrl+Enter 也能提交', async () => {
    const wrapper = mount(Composer)

    await wrapper.find('#postContent').setValue('快捷键一条')
    await wrapper.find('#postContent').trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(usePostsStore().posts[0].content).toBe('快捷键一条')
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
    await flushPromises()

    expect(store.posts[0].channel).toBe('night')
  })
})
