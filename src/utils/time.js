const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function pad(value) {
  return value < 10 ? '0' + value : String(value)
}

/**
 * 相对时间格式化（纯函数，可注入“当前时间”便于测试）
 * 刚刚 / N 分钟前 / N 小时前 / N 天前 / YYYY-MM-DD
 */
export function formatRelativeTime(timestamp, now = Date.now()) {
  const diff = now - timestamp

  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return Math.floor(diff / MINUTE) + ' 分钟前'
  if (diff < DAY) return Math.floor(diff / HOUR) + ' 小时前'
  if (diff < 7 * DAY) return Math.floor(diff / DAY) + ' 天前'

  const date = new Date(timestamp)
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}
