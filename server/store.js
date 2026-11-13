/**
 * 内存帖子存储工厂。
 *
 * 设计要点：
 * - 不使用模块级可变单例，每个 createPostStore() 都是独立数据集，便于测试与将来替换为真实 DB；
 * - now / idFactory 可注入，保证测试可确定性断言；
 * - 对外只暴露 Post 的深拷贝可写副本，调用方改不到内部状态；
 * - 排序：createdAt 倒序；时间戳相同时按插入序号倒序（后插入的在前）；
 * - 点赞 / 收藏只存「谁做过这件事」的 Set，计数字段由 Set.size 派生：
 *   这样计数天然不会为负、不会重复累加，也不必担心两个字段互相覆盖。
 */

export const CHANNELS = Object.freeze(['shade', 'night', 'breeze'])
export const DEFAULT_CHANNEL = 'shade'
export const ALL_CHANNELS = 'all'
export const MAX_CONTENT_LENGTH = 300

/** 无法识别访客时统一落到这个身份，保证匿名访问也能各自记住状态 */
export const DEFAULT_VISITOR = 'anonymous'
export const MAX_VISITOR_ID_LENGTH = 64

export function isChannel(value) {
  return CHANNELS.includes(value)
}

/**
 * 把请求头里的访客标识收敛成可信值：去首尾空白后长度 1–64 才有效。
 * 不做格式校验（前端可能退化为随机串），超出范围一律视为匿名，避免脏数据撑爆内存键。
 * @param {unknown} value
 */
export function normalizeVisitorId(value) {
  if (typeof value !== 'string') return DEFAULT_VISITOR

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_VISITOR_ID_LENGTH) return DEFAULT_VISITOR

  return trimmed
}

function defaultIdFactory() {
  return globalThis.crypto.randomUUID()
}

/** toggle 语义：同一个访客重复调用在「加入」与「移除」之间翻转 */
function flip(set, visitor) {
  if (set.has(visitor)) set.delete(visitor)
  else set.add(visitor)
}

/**
 * @param {{ now?: () => number, idFactory?: () => string }} [options]
 */
export function createPostStore(options = {}) {
  const { now = Date.now, idFactory = defaultIdFactory } = options

  /**
   * @type {{
   *   seq: number,
   *   post: { id: string, content: string, createdAt: number, channel: string },
   *   likedBy: Set<string>,
   *   favoritedBy: Set<string>
   * }[]}
   */
  const entries = []
  let seq = 0

  /** 每次调用都新建对象，调用方拿到的永远是可写但无副作用的副本 */
  const toPublic = (entry, visitorId) => {
    const visitor = normalizeVisitorId(visitorId)

    return {
      ...entry.post,
      likes: entry.likedBy.size,
      favorites: entry.favoritedBy.size,
      liked: entry.likedBy.has(visitor),
      favorited: entry.favoritedBy.has(visitor)
    }
  }

  const find = (id) => entries.find((item) => item.post.id === id)

  /**
   * @param {{ channel?: string, visitorId?: string }} [query] channel 为空或 'all' 时返回全部
   */
  function list({ channel, visitorId } = {}) {
    const scoped = channel && channel !== ALL_CHANNELS
      ? entries.filter((entry) => entry.post.channel === channel)
      : entries

    return scoped
      .slice()
      .sort((a, b) => b.post.createdAt - a.post.createdAt || b.seq - a.seq)
      .map((entry) => toPublic(entry, visitorId))
  }

  function get(id, visitorId) {
    const entry = find(id)
    return entry ? toPublic(entry, visitorId) : undefined
  }

  function create({ content, channel } = {}) {
    const post = {
      id: String(idFactory()),
      content,
      createdAt: now(),
      channel: isChannel(channel) ? channel : DEFAULT_CHANNEL
    }

    const entry = { seq: 0, post, likedBy: new Set(), favoritedBy: new Set() }
    seq += 1
    entry.seq = seq
    entries.push(entry)

    return toPublic(entry)
  }

  function remove(id) {
    const index = entries.findIndex((entry) => entry.post.id === id)
    if (index === -1) return false
    // 条目连同两个访客集合一起被丢弃，不会留下孤儿状态
    entries.splice(index, 1)
    return true
  }

  function toggleLike(id, visitorId) {
    const entry = find(id)
    if (!entry) return undefined

    flip(entry.likedBy, normalizeVisitorId(visitorId))
    return toPublic(entry, visitorId)
  }

  function toggleFavorite(id, visitorId) {
    const entry = find(id)
    if (!entry) return undefined

    flip(entry.favoritedBy, normalizeVisitorId(visitorId))
    return toPublic(entry, visitorId)
  }

  function reset() {
    entries.length = 0
    seq = 0
  }

  return { list, get, create, remove, toggleLike, toggleFavorite, reset }
}
