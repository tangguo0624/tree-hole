import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from '../../src/stores/toast'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toast store', () => {
  it('初始不可见', () => {
    const toast = useToastStore()
    expect(toast.visible).toBe(false)
    expect(toast.message).toBe('')
  })

  it('show 之后可见且携带文案', () => {
    const toast = useToastStore()
    toast.show('已投进树洞')
    expect(toast.visible).toBe(true)
    expect(toast.message).toBe('已投进树洞')
  })

  it('超时后自动隐藏', () => {
    const toast = useToastStore()
    toast.show('稍纵即逝', 2400)
    vi.advanceTimersByTime(2399)
    expect(toast.visible).toBe(true)
    vi.advanceTimersByTime(1)
    expect(toast.visible).toBe(false)
  })

  it('连续 show 复用同一定时器，以最后一条为准', () => {
    const toast = useToastStore()
    toast.show('第一条', 2400)
    vi.advanceTimersByTime(2000)
    toast.show('第二条', 2400)
    vi.advanceTimersByTime(2300)
    expect(toast.visible).toBe(true)
    expect(toast.message).toBe('第二条')
    vi.advanceTimersByTime(100)
    expect(toast.visible).toBe(false)
  })

  it('hide 立即隐藏', () => {
    const toast = useToastStore()
    toast.show('马上消失')
    toast.hide()
    expect(toast.visible).toBe(false)
  })
})
