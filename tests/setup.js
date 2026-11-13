/**
 * 测试环境修复（仅测试时加载，浏览器不受影响）：
 *
 * 1. Node 26 引入实验性全局 localStorage，未提供 --localstorage-file 时恒为 undefined；
 * 2. vitest 的 jsdom 环境下 window.localStorage 也可能缺失（见同目录探针测试）。
 *
 * 这里提供一个 Web Storage 规范兼容的内存实现，保证：
 * - 裸 `localStorage` 引用可用且行为与浏览器一致；
 * - 各测试文件之间共享同一个实例（与真实浏览器同源行为一致，需自行 clear）。
 */
function createMemoryStorage() {
  const store = new Map()
  const toKey = (key) => String(key)
  return {
    get length() {
      return store.size
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null
    },
    getItem(key) {
      const k = toKey(key)
      return store.has(k) ? store.get(k) : null
    },
    setItem(key, value) {
      store.set(toKey(key), String(value))
    },
    removeItem(key) {
      store.delete(toKey(key))
    },
    clear() {
      store.clear()
    }
  }
}

const memoryStorage = createMemoryStorage()

if (typeof window !== 'undefined' && !window.localStorage) {
  try {
    Object.defineProperty(window, 'localStorage', {
      value: memoryStorage,
      configurable: true,
      writable: true
    })
  } catch (error) {
    console.warn('[setup] window.localStorage 注入失败：', error)
  }
}

if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true
  })
}
