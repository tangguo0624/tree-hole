<script setup>
import { computed } from 'vue'
import { CHANNELS, DEFAULT_CHANNEL } from '../stores/posts'
import { formatRelativeTime } from '../utils/time'

const props = defineProps({
  post: { type: Object, required: true }
})

// 纯展示组件：只抛出意图，由列表层决定接到哪个 store action
const emit = defineEmits(['like', 'favorite'])

const channelLabel = computed(() => {
  const channel = CHANNELS.find((item) => item.id === props.post.channel)
  return (channel || CHANNELS.find((item) => item.id === DEFAULT_CHANNEL)).label
})

const timeText = computed(() => formatRelativeTime(props.post.createdAt))
const isoTime = computed(() => new Date(props.post.createdAt).toISOString())

/** 计数兜底：历史数据 / 桩数据缺字段时按 0 展示，不出现 undefined 或负数 */
function normalizeCount(value) {
  const num = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0
}

const likeCount = computed(() => normalizeCount(props.post.likes))
const favoriteCount = computed(() => normalizeCount(props.post.favorites))
const isLiked = computed(() => props.post.liked === true)
const isFavorited = computed(() => props.post.favorited === true)
</script>

<template>
  <li class="post" :data-id="post.id">
    <div class="post__avatar" aria-hidden="true"></div>
    <div class="post__body">
      <div class="post__meta">
        <span class="post__channel">{{ channelLabel }}</span>
        <time class="post__time" :datetime="isoTime">{{ timeText }}</time>
      </div>
      <!-- 插值按纯文本输出，天然防注入 -->
      <p class="post__content">{{ post.content }}</p>

      <div class="post__actions">
        <button
          type="button"
          class="post__action post__action--like"
          :class="{ 'is-active': isLiked }"
          :aria-pressed="isLiked ? 'true' : 'false'"
          aria-label="点赞"
          @click="emit('like', post.id)"
        >
          <svg class="post__action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 20.2c-1-.6-7.4-4.7-7.4-9.5A4.3 4.3 0 0 1 12 8.1a4.3 4.3 0 0 1 7.4 2.6c0 4.8-6.4 8.9-7.4 9.5Z" />
          </svg>
          <span class="post__action-count">{{ likeCount }}</span>
        </button>

        <button
          type="button"
          class="post__action post__action--favorite"
          :class="{ 'is-active': isFavorited }"
          :aria-pressed="isFavorited ? 'true' : 'false'"
          aria-label="收藏"
          @click="emit('favorite', post.id)"
        >
          <svg class="post__action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7.4 4.6h9.2a1.2 1.2 0 0 1 1.2 1.2v13.9l-5.8-3.9-5.8 3.9V5.8a1.2 1.2 0 0 1 1.2-1.2Z" />
          </svg>
          <span class="post__action-count">{{ favoriteCount }}</span>
        </button>
      </div>
    </div>
  </li>
</template>
