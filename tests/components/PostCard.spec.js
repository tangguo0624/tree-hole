import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PostCard from '../../src/components/PostCard.vue'

function makePost(overrides = {}) {
  return {
    id: 'p-1',
    content: '今天的风很温柔。',
    createdAt: Date.now() - 5 * 60 * 1000,
    channel: 'night',
    ...overrides
  }
}

describe('PostCard 组件', () => {
  it('渲染正文、频道徽标与相对时间', () => {
    const wrapper = mount(PostCard, { props: { post: makePost() } })
    expect(wrapper.find('.post__content').text()).toBe('今天的风很温柔。')
    expect(wrapper.find('.post__channel').text()).toBe('深夜')
    expect(wrapper.find('.post__time').text()).toBe('5 分钟前')
    expect(wrapper.find('time').attributes('datetime')).toContain('T')
  })

  it('正文按纯文本插值输出，HTML 不会被注入', () => {
    const evil = '<img src=x onerror="alert(1)"><script>bad()</script>'
    const wrapper = mount(PostCard, { props: { post: makePost({ content: evil }) } })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('.post__content').text()).toContain('<img src=x')
  })

  it('保留换行（white-space: pre-wrap 由样式保证，文本原样传递）', () => {
    const wrapper = mount(PostCard, {
      props: { post: makePost({ content: '第一行\n第二行' }) }
    })
    expect(wrapper.find('.post__content').text()).toBe('第一行\n第二行')
  })

  it('未知频道回退为默认频道标签', () => {
    const wrapper = mount(PostCard, {
      props: { post: makePost({ channel: 'unknown' }) }
    })
    expect(wrapper.find('.post__channel').text()).toBe('树荫')
  })
})
