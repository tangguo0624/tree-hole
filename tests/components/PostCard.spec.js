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

describe('PostCard 点赞 / 收藏', () => {
  it('底部渲染点赞与收藏两个按钮，类型为 button', () => {
    const wrapper = mount(PostCard, { props: { post: makePost() } })
    const actions = wrapper.find('.post__actions')
    expect(actions.exists()).toBe(true)

    const like = wrapper.find('.post__action--like')
    const favorite = wrapper.find('.post__action--favorite')
    expect(like.exists()).toBe(true)
    expect(favorite.exists()).toBe(true)
    expect(like.classes()).toContain('post__action')
    expect(favorite.classes()).toContain('post__action')
    expect(like.attributes('type')).toBe('button')
    expect(favorite.attributes('type')).toBe('button')
  })

  it('两个按钮都有 aria-label 与 aria-pressed，默认未激活', () => {
    const wrapper = mount(PostCard, { props: { post: makePost() } })
    const like = wrapper.find('.post__action--like')
    const favorite = wrapper.find('.post__action--favorite')

    expect(like.attributes('aria-label')).toBe('点赞')
    expect(favorite.attributes('aria-label')).toBe('收藏')
    expect(like.attributes('aria-pressed')).toBe('false')
    expect(favorite.attributes('aria-pressed')).toBe('false')
    expect(like.classes()).not.toContain('is-active')
    expect(favorite.classes()).not.toContain('is-active')
  })

  it('计数为 0 时也渲染 0', () => {
    const wrapper = mount(PostCard, { props: { post: makePost({ likes: 0, favorites: 0 }) } })
    expect(wrapper.find('.post__action--like .post__action-count').text()).toBe('0')
    expect(wrapper.find('.post__action--favorite .post__action-count').text()).toBe('0')
  })

  it('缺计数字段时按 0 渲染，避免出现 undefined', () => {
    const wrapper = mount(PostCard, { props: { post: makePost() } })
    expect(wrapper.find('.post__action--like .post__action-count').text()).toBe('0')
    expect(wrapper.find('.post__action--like').text()).not.toContain('undefined')
  })

  it('已点赞 / 已收藏时显示真实计数并进入激活态', () => {
    const wrapper = mount(PostCard, {
      props: { post: makePost({ likes: 12, favorites: 3, liked: true, favorited: true }) }
    })
    const like = wrapper.find('.post__action--like')
    const favorite = wrapper.find('.post__action--favorite')

    expect(like.find('.post__action-count').text()).toBe('12')
    expect(favorite.find('.post__action-count').text()).toBe('3')
    expect(like.classes()).toContain('is-active')
    expect(favorite.classes()).toContain('is-active')
    expect(like.attributes('aria-pressed')).toBe('true')
    expect(favorite.attributes('aria-pressed')).toBe('true')
  })

  it('内联 SVG 图标存在且对读屏隐藏', () => {
    const wrapper = mount(PostCard, { props: { post: makePost() } })
    const icons = wrapper.findAll('.post__action-icon')

    expect(icons.length).toBe(2)
    expect(icons[0].element.tagName.toLowerCase()).toBe('svg')
    icons.forEach((icon) => {
      expect(icon.attributes('aria-hidden')).toBe('true')
      expect(icon.attributes('focusable')).toBe('false')
    })
  })

  it('点击点赞只 emit like，并带上 post.id', async () => {
    const wrapper = mount(PostCard, { props: { post: makePost({ id: 'abc' }) } })

    await wrapper.find('.post__action--like').trigger('click')

    expect(wrapper.emitted('like')).toEqual([['abc']])
    expect(wrapper.emitted('favorite')).toBeUndefined()
  })

  it('点击收藏只 emit favorite，并带上 post.id', async () => {
    const wrapper = mount(PostCard, { props: { post: makePost({ id: 'xyz' }) } })

    await wrapper.find('.post__action--favorite').trigger('click')

    expect(wrapper.emitted('favorite')).toEqual([['xyz']])
    expect(wrapper.emitted('like')).toBeUndefined()
  })
})
