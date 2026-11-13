/**
 * 一键开发脚本：同时启动 Hono API（8787）与 Vite 开发服务器（5173）。
 * 不引入额外依赖，用 child_process 直接拉起两个 node 进程。
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js')

const targets = [
  { name: 'api', args: [join(root, 'server', 'index.js')], color: '\u001b[32m' },
  { name: 'web', args: [viteBin], color: '\u001b[36m' }
]

const children = []

function prefixStream(stream, name, color) {
  let buffer = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      process.stdout.write(`${color}[${name}]\u001b[0m ${line}\n`)
    }
  })
}

for (const target of targets) {
  const child = spawn(process.execPath, target.args, {
    cwd: root,
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  prefixStream(child.stdout, target.name, target.color)
  prefixStream(child.stderr, target.name, target.color)

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[dev] ${target.name} 进程退出，code=${code}`)
      shutdown(code ?? 1)
    }
  })

  children.push(child)
}

let closing = false
function shutdown(code = 0) {
  if (closing) return
  closing = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
