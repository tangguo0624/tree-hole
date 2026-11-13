/** 测试用最小后端：一个内存数组 + 与 Hono 契约一致的 fetch 实现 */
export function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }
}

export function createFakeBackend(initialPosts = []) {
  const db = initialPosts.map((post) => ({ ...post }))
  const calls = []
  let seq = 0

  async function fetchImpl(url, init = {}) {
    const path = String(url)
    const method = (init.method || 'GET').toUpperCase()
    const body = init.body ? JSON.parse(init.body) : null
    calls.push({ url: path, method, body })

    if (method === 'GET' && path.startsWith('/api/posts')) {
      const match = path.match(/[?&]channel=([^&]+)/)
      const channel = match ? decodeURIComponent(match[1]) : null
      const posts = channel ? db.filter((post) => post.channel === channel) : db
      return jsonResponse({ posts: posts.map((post) => ({ ...post })) })
    }

    if (method === 'POST' && path === '/api/posts') {
      seq += 1
      const post = {
        id: `srv-${seq}`,
        content: body.content,
        channel: body.channel,
        createdAt: Date.now() + seq
      }
      db.unshift(post)
      return jsonResponse({ post: { ...post } }, 201)
    }

    if (method === 'DELETE' && path.startsWith('/api/posts/')) {
      const id = decodeURIComponent(path.slice('/api/posts/'.length))
      const index = db.findIndex((post) => post.id === id)
      if (index === -1) {
        return jsonResponse({ error: { code: 'NOT_FOUND', message: '这条声音不在了' } }, 404)
      }
      db.splice(index, 1)
      return {
        ok: true,
        status: 204,
        json: async () => {
          throw new Error('204 没有响应体')
        }
      }
    }

    return jsonResponse({ error: { code: 'NOT_FOUND', message: '找不到接口' } }, 404)
  }

  return { db, calls, fetchImpl }
}
