import { describe, it, expect } from 'vitest'
import { formatRelativeTime, pad } from '../../src/utils/time'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('pad', () => {
  it('个位数补零', () => {
    expect(pad(0)).toBe('00')
    expect(pad(9)).toBe('09')
  })

  it('两位数原样返回', () => {
    expect(pad(10)).toBe('10')
    expect(pad(31)).toBe('31')
  })
})

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-11-13T12:00:00').getTime()

  it('1 分钟内显示「刚刚」', () => {
    expect(formatRelativeTime(NOW - 30 * 1000, NOW)).toBe('刚刚')
    expect(formatRelativeTime(NOW, NOW)).toBe('刚刚')
  })

  it('不足 1 小时显示分钟', () => {
    expect(formatRelativeTime(NOW - 1 * MINUTE, NOW)).toBe('1 分钟前')
    expect(formatRelativeTime(NOW - 59 * MINUTE, NOW)).toBe('59 分钟前')
  })

  it('不足 1 天显示小时', () => {
    expect(formatRelativeTime(NOW - 1 * HOUR, NOW)).toBe('1 小时前')
    expect(formatRelativeTime(NOW - 23 * HOUR - 59 * MINUTE, NOW)).toBe('23 小时前')
  })

  it('不足 7 天显示天数', () => {
    expect(formatRelativeTime(NOW - 1 * DAY, NOW)).toBe('1 天前')
    expect(formatRelativeTime(NOW - 6 * DAY - 23 * HOUR, NOW)).toBe('6 天前')
  })

  it('7 天前显示具体日期（本地时区）', () => {
    expect(formatRelativeTime(NOW - 7 * DAY, NOW)).toBe('2026-11-06')
    expect(formatRelativeTime(new Date('2025-01-05T08:00:00').getTime(), NOW)).toBe('2025-01-05')
  })

  it('默认以当前时间作为参照', () => {
    expect(formatRelativeTime(Date.now())).toBe('刚刚')
  })
})
