import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import BrandWordmark from '../../src/components/BrandWordmark.vue'

function mountWordmark() {
  // 组件本身不碰 store，这里仍提供 Pinia，保持与其它组件测试的挂载约定一致
  return mount(BrandWordmark, { global: { plugins: [createPinia()] } })
}

describe('BrandWordmark 手写品牌字', () => {
  it('根节点带 data-brand 标记', () => {
    const wrapper = mountWordmark()

    expect(wrapper.find('[data-brand="wordmark"]').exists()).toBe(true)
  })

  it('h1 中渲染「树」「洞」两个字符 span', () => {
    const wrapper = mountWordmark()

    const chars = wrapper.findAll('.wordmark__char')
    expect(chars.length).toBe(2)
    expect(chars[0].text()).toBe('树')
    expect(chars[1].text()).toBe('洞')
    // 标题文本保持完整，屏幕阅读器与 SEO 都读到「树洞」
    expect(wrapper.find('h1').text()).toBe('树洞')
  })

  it('装饰用 SVG 全部对辅助技术隐藏', () => {
    const wrapper = mountWordmark()

    const decorations = wrapper.findAll('svg')
    expect(decorations.length).toBeGreaterThanOrEqual(4)

    decorations.forEach((svg) => {
      expect(svg.attributes('aria-hidden')).toBe('true')
    })
  })

  it('英文副标题存在且为小写', () => {
    const wrapper = mountWordmark()

    const tagline = wrapper.find('.wordmark__tagline')
    expect(tagline.exists()).toBe(true)
    expect(tagline.text()).toBe('let the wind keep your words')
    expect(tagline.text()).toBe(tagline.text().toLowerCase())
  })

  it('装饰不进入 h1，标题文本不被污染', () => {
    const wrapper = mountWordmark()

    expect(wrapper.find('h1').find('svg').exists()).toBe(false)
    expect(wrapper.find('h1').text()).not.toContain('let the wind')
  })
})
