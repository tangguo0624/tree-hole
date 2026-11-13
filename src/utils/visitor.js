/**
 * 访客标识：只用于让后端区分「我点过赞 / 收过藏」，不含任何个人信息。
 *
 * 刻意不使用 localStorage / sessionStorage：
 * 存储型标识会在共享设备上长期残留，也会让「匿名」变得可追踪；
 * 每次打开页面生成一个新标识，刷新后点赞态由服务端按新标识重新计算即可。
 */

let cachedVisitorId = null

const FALLBACK_ALPHABET = 'abcdef0123456789'
const FALLBACK_LENGTH = 32

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
  return cachedVisitorId
}

export default getVisitorId
