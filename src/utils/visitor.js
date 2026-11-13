/**
 * 访客标识：只用于让后端区分「我点过赞 / 收过藏」，不含任何个人信息。
 *
 * 为什么把这个随机串放进 sessionStorage：
 * - 留言内容仍然只存在服务端（本项目的核心要求），本地只多了一个随机标识；
 * - sessionStorage 随标签页关闭即失效，不会像 localStorage 那样在共享设备上长期
 *   留痕，也不会把「匿名」变成一个可长期追踪的身份；
 * - 没有它的话，刷新一次页面就会换一个身份，用户会看到自己刚点的赞「消失」了。
 */

export const VISITOR_STORAGE_KEY = 'treehole:visitor-id'

let cachedVisitorId = null

const FALLBACK_ALPHABET = 'abcdef0123456789'
const FALLBACK_LENGTH = 32
const MAX_ID_LENGTH = 64

/** 部分隐私模式 / 沙箱里访问 sessionStorage 会抛错，这里统一降级为 null */
function getStorage() {
  try {
    return globalThis.sessionStorage ?? null
  } catch (error) {
    return null
  }
}

/** 读到合法值才复用：长度与字符都做收敛，避免脏数据被后端再归一一次 */
function readStoredId() {
  const storage = getStorage()
  if (!storage) return null

  try {
    const value = storage.getItem(VISITOR_STORAGE_KEY)
    if (typeof value !== 'string') return null

    const trimmed = value.trim()
    return trimmed && trimmed.length <= MAX_ID_LENGTH ? trimmed : null
  } catch (error) {
    return null
  }
}

function persistId(id) {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(VISITOR_STORAGE_KEY, id)
  } catch (error) {
    // 存储写满或被禁用时只是失去跨刷新记忆，不影响本次会话
  }
}

/** crypto.randomUUID 不可用时的兜底：时间戳 + 随机串，长度仍在服务端接受范围内 */
function createFallbackId() {
  let random = ''
  for (let i = 0; i < FALLBACK_LENGTH; i += 1) {
    random += FALLBACK_ALPHABET[Math.floor(Math.random() * FALLBACK_ALPHABET.length)]
  }
  return `v-${Date.now().toString(36)}-${random}`
}

/** 模块内惰性生成一次，本次会话内所有请求共用同一个标识 */
export function getVisitorId() {
  if (cachedVisitorId) return cachedVisitorId

  const stored = readStoredId()
  if (stored) {
    cachedVisitorId = stored
    return cachedVisitorId
  }

  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    try {
      cachedVisitorId = cryptoObj.randomUUID()
    } catch (error) {
      // 某些环境下 randomUUID 存在但不可用（非安全上下文），走兜底分支
      cachedVisitorId = null
    }
  }

  if (!cachedVisitorId) cachedVisitorId = createFallbackId()

  persistId(cachedVisitorId)
  return cachedVisitorId
}

export default getVisitorId
