import { defineStore } from 'pinia'
import { postsApi, ApiError, NETWORK_ERROR } from '../api/posts'

export const MAX_LENGTH = 300
export const WARN_THRESHOLD = 280
export const CHANNELS = [
  { id: 'shade', label: '树荫' },
  { id: 'night', label: '深夜' },
  { id: 'breeze', label: '微风' }
]
export const DEFAULT_CHANNEL = 'shade'

export const ERROR_MESSAGES = {
  network: '暂时连不上树洞，请稍后再试',
  server: '树洞的小屋有点忙，请稍后再试',
  rejected: '这一条没能送进树洞，请稍后再试'
}

function isValidChannel(id) {
  return CHANNELS.some((channel) => channel.id === id)
}

/** 把服务端/历史数据规范成安全结构，非法条目返回 null */
function normalizePost(item) {
  if (!item || typeof item !== 'object') return null
  if (item.id === undefined || item.id === null || item.id === '') return null
  if (typeof item.content !== 'string' || !item.content.trim()) return null
  if (typeof item.createdAt !== 'number' || !isFinite(item.createdAt)) return null
  return {
    id: String(item.id),
    content: item.content.slice(0, MAX_LENGTH),
    createdAt: item.createdAt,
    channel: isValidChannel(item.channel) ? item.channel : DEFAULT_CHANNEL
  }
}

/** 把异常翻译成能直接展示给用户的一句话 */
function toReadableError(error) {
  if (error instanceof ApiError) {
    if (error.code === NETWORK_ERROR || error.status === 0) return ERROR_MESSAGES.network
    if (error.status >= 500) return ERROR_MESSAGES.server
    if (error.status >= 400) return ERROR_MESSAGES.rejected
  }
  return ERROR_MESSAGES.network
}

export const usePostsStore = defineStore('posts', {
  state: () => ({
    posts: [],
    activeChannel: 'all',
    composerChannel: DEFAULT_CHANNEL,
    loading: false,
    publishing: false,
    error: null
  }),

  getters: {
    /** 当前频道下可见的帖子（倒序） */
    visiblePosts(state) {
      if (state.activeChannel === 'all') return state.posts
      return state.posts.filter((post) => post.channel === state.activeChannel)
    },
    totalCount: (state) => state.posts.length,
    channelCount() {
      return this.visiblePosts.length
    },
    /** 全站是否一条内容都没有（区别于“当前频道为空”） */
    isTotallyEmpty: (state) => state.posts.length === 0
  },

  actions: {
    channelLabel(id) {
      const channel = CHANNELS.find((item) => item.id === id)
      return channel ? channel.label : CHANNELS.find((item) => item.id === DEFAULT_CHANNEL).label
    },

    hasChannelContent(id) {
      return this.posts.some((post) => post.channel === id)
    },

    /**
     * 从 REST API 拉取列表；失败降级为空列表，不向上抛错。
     * 始终拉全量：频道过滤在 `visiblePosts` 里做，避免切换频道时拿到残缺缓存导致计数错误。
     */
    async load() {
      this.loading = true
      this.error = null

      try {
        const list = await postsApi.list()
        this.posts = (Array.isArray(list) ? list : [])
          .map(normalizePost)
          .filter(Boolean)
          .sort((a, b) => b.createdAt - a.createdAt)
        return this.posts
      } catch (error) {
        console.warn('[树洞] 读取失败，已按空列表展示。', error)
        this.posts = []
        this.error = toReadableError(error)
        return this.posts
      } finally {
        this.loading = false
      }
    },

    /** 发布一条：校验 → 请求后端 → 用后端返回的数据插入头部；成功返回 true */
    async publish(content) {
      const trimmed = typeof content === 'string' ? content.trim() : ''
      if (!trimmed) return false
      if (this.publishing) return false

      this.publishing = true
      this.error = null

      try {
        const created = await postsApi.create({
          content: trimmed.slice(0, MAX_LENGTH),
          channel: this.composerChannel
        })
        const post = normalizePost(created)
        if (!post) {
          console.warn('[树洞] 服务端返回的数据不可用。', created)
          this.error = ERROR_MESSAGES.rejected
          return false
        }
        this.posts.unshift(post)
        return true
      } catch (error) {
        console.warn('[树洞] 发布失败。', error)
        this.error = toReadableError(error)
        return false
      } finally {
        this.publishing = false
      }
    },

    setChannel(id) {
      this.activeChannel = id
    },

    setComposerChannel(id) {
      if (isValidChannel(id)) this.composerChannel = id
    },

    clearError() {
      this.error = null
    }
  }
})
