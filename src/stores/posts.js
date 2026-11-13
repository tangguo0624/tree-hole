import { defineStore } from 'pinia'

export const STORAGE_KEY = 'treehole.posts.v1'
export const MAX_LENGTH = 300
export const WARN_THRESHOLD = 280
export const CHANNELS = [
  { id: 'shade', label: '树荫' },
  { id: 'night', label: '深夜' },
  { id: 'breeze', label: '微风' }
]
export const DEFAULT_CHANNEL = 'shade'

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function isValidChannel(id) {
  return CHANNELS.some((channel) => channel.id === id)
}

/** 把外部/历史数据规范成安全结构，非法条目返回 null */
function normalizePost(item) {
  if (!item || typeof item !== 'object') return null
  if (typeof item.content !== 'string' || !item.content.trim()) return null
  if (typeof item.createdAt !== 'number' || !isFinite(item.createdAt)) return null
  return {
    id: item.id ? String(item.id) : createId(),
    content: item.content.slice(0, MAX_LENGTH),
    createdAt: item.createdAt,
    channel: isValidChannel(item.channel) ? item.channel : DEFAULT_CHANNEL
  }
}

export const usePostsStore = defineStore('posts', {
  state: () => ({
    posts: [],
    activeChannel: 'all',
    composerChannel: DEFAULT_CHANNEL,
    storageBroken: false
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

    /** 从 LocalStorage 读取，坏数据自动降级为空列表 */
    load() {
      this.storageBroken = false

      let raw = null
      try {
        raw = localStorage.getItem(STORAGE_KEY)
      } catch (error) {
        console.warn('[树洞] 本地存储不可用。', error)
        this.storageBroken = true
        this.posts = []
        return
      }

      if (!raw) {
        this.posts = []
        return
      }

      try {
        const data = JSON.parse(raw)
        if (!Array.isArray(data)) throw new Error('本地数据格式不是数组')
        this.posts = data
          .map(normalizePost)
          .filter(Boolean)
          .sort((a, b) => b.createdAt - a.createdAt)
      } catch (error) {
        console.warn('[树洞] 本地数据解析失败，已按空列表展示。', error)
        this.posts = []
      }
    },

    /** 写入 LocalStorage，失败仅标记不抛错 */
    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.posts))
        return true
      } catch (error) {
        console.warn('[树洞] 写入本地存储失败。', error)
        this.storageBroken = true
        return false
      }
    },

    /** 发布一条：校验 → 入列 → 持久化；成功返回 true */
    publish(content) {
      const trimmed = typeof content === 'string' ? content.trim() : ''
      if (!trimmed) return false

      this.posts.unshift({
        id: createId(),
        content: trimmed.slice(0, MAX_LENGTH),
        createdAt: Date.now(),
        channel: this.composerChannel
      })
      this.save()
      return true
    },

    setChannel(id) {
      this.activeChannel = id
    },

    setComposerChannel(id) {
      if (isValidChannel(id)) this.composerChannel = id
    }
  }
})
