<script setup>
import { computed } from 'vue'
import { CHANNELS, DEFAULT_CHANNEL } from '../stores/posts'
import { formatRelativeTime } from '../utils/time'

const props = defineProps({
  post: { type: Object, required: true }
})

const channelLabel = computed(() => {
  const channel = CHANNELS.find((item) => item.id === props.post.channel)
  return (channel || CHANNELS.find((item) => item.id === DEFAULT_CHANNEL)).label
})

const timeText = computed(() => formatRelativeTime(props.post.createdAt))
const isoTime = computed(() => new Date(props.post.createdAt).toISOString())
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
    </div>
  </li>
</template>
