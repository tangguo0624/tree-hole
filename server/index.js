/**
 * 进程入口：只做「读端口 → 启动 → 打印日志」，业务逻辑全在 app.js / store.js。
 * 被 import 时不启动端口，方便外部（含测试）直接复用已装配好的 app。
 */
import { pathToFileURL } from 'node:url'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createPostStore } from './store.js'

export const DEFAULT_PORT = 8787

export const store = createPostStore()
export const app = createApp({ store })

/** 读取并校验 PORT，非法时回落到默认端口 */
export function resolvePort(env = process.env) {
  const parsed = Number.parseInt(env.PORT ?? '', 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return DEFAULT_PORT
  return parsed
}

function isEntryModule() {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return import.meta.url === pathToFileURL(entry).href
  } catch {
    return false
  }
}

if (isEntryModule()) {
  const port = resolvePort()
  serve({ fetch: app.fetch, port }, (info) => {
    // 刻意用 ASCII，避免 Windows PowerShell 控制台（GBK）把日志显示成乱码
    console.log(`[api] tree-hole API ready: http://127.0.0.1:${info.port}`)
  })
}
