/**
 * 内存帖子存储工厂。
 *
 * 设计要点：
 * - 不使用模块级可变单例，每个 createPostStore() 都是独立数据集，便于测试与将来替换为真实 DB；
 * - now / idFactory 可注入，保证测试可确定性断言；
 * - 对外只暴露 Post 的浅拷贝，调用方改不到内部状态；
 * - 排序：createdAt 倒序；时间戳相同时按插入序号倒序（后插入的在前）。
 */

export const CHANNELS = Object.freeze(['shade', 'night', 'breeze'])
export const DEFAULT_CHANNEL = 'shade'
export const ALL_CHANNELS = 'all'
export const MAX_CONTENT_LENGTH = 300

export function isChannel(value) {
  return CHANNELS.includes(value)
}

function defaultIdFactory() {
  return globalThis.crypto.randomUUID()
}

/**
 * @param {{ now?: () => number, idFactory?: () => string }} [options]
 */
export function createPostStore(options = {}) {
  const { now = Date.now, idFactory = defaultIdFactory } = options

  /** @type {{ seq: number, post: { id: string, content: string, createdAt: number, channel: string } }[]} */
  const entries = []
  let seq = 0

  const toPublic = (entry) => ({ ...entry.post })

  /**
   * @param {{ channel?: string }} [query] channel 为空或 'all' 时返回全部
   */
  function list({ channel } = {}) {
    const scoped = channel && channel !== ALL_CHANNELS
      ? entries.filter((entry) => entry.post.channel === channel)
      : entries

    return scoped
      .slice()
      .sort((a, b) => b.post.createdAt - a.post.createdAt || b.seq - a.seq)
      .map(toPublic)
  }

  function get(id) {
    const entry = entries.find((item) => item.post.id === id)
    return entry ? toPublic(entry) : undefined
  }

  function create({ content, channel } = {}) {
    const post = {
      id: String(idFactory()),
      content,
      createdAt: now(),
      channel: isChannel(channel) ? channel : DEFAULT_CHANNEL
    }

    seq += 1
    entries.push({ seq, post })

    return { ...post }
  }

  function remove(id) {
    const index = entries.findIndex((entry) => entry.post.id === id)
    if (index === -1) return false
    entries.splice(index, 1)
    return true
  }

  function reset() {
    entries.length = 0
    seq = 0
  }

  return { list, get, create, remove, reset }
}
