<script setup>
import { computed } from 'vue'
import { usePostsStore } from '../stores/posts'
import PostCard from './PostCard.vue'

const store = usePostsStore()

const showEmpty = computed(() => store.visiblePosts.length === 0)
const emptyTitle = computed(() => (store.isTotallyEmpty ? '这里还很安静' : '这个角落还很安静'))
const emptyDesc = computed(() =>
  store.isTotallyEmpty ? '说第一句吧，风会替你记着。' : '换个频道看看，或者在这里说第一句。'
)
</script>

<template>
  <section class="timeline" aria-labelledby="timelineTitle">
    <div class="timeline__head">
      <h2 id="timelineTitle"><span class="timeline__dot" aria-hidden="true"></span>洞里的声音</h2>
      <span class="timeline__hint">最新在前</span>
    </div>

    <ul class="post-list" id="postList">
      <PostCard v-for="post in store.visiblePosts" :key="post.id" :post="post" />
    </ul>

    <div class="empty" id="emptyState" :hidden="!showEmpty">
      <div class="empty__art">
        <svg class="empty__tree" viewBox="0 0 160 140" role="img" aria-label="一棵安静的树">
          <defs>
            <linearGradient id="canopyGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#B4D496" />
              <stop offset="100%" stop-color="#3E6B34" />
            </linearGradient>
          </defs>
          <ellipse cx="80" cy="130" rx="44" ry="6" fill="#3E6B34" opacity="0.09" />
          <path d="M80 128V84" stroke="#6E9C55" stroke-width="5" stroke-linecap="round" />
          <path d="M80 100l-14-10M80 108l14-11" stroke="#6E9C55" stroke-width="3" stroke-linecap="round" />
          <circle cx="80" cy="60" r="33" fill="url(#canopyGrad)" opacity="0.95" />
          <circle cx="51" cy="76" r="21" fill="url(#canopyGrad)" opacity="0.75" />
          <circle cx="109" cy="78" r="19" fill="url(#canopyGrad)" opacity="0.7" />
          <circle cx="82" cy="38" r="17" fill="#A8CC8B" opacity="0.7" />
        </svg>
      </div>
      <h3 id="emptyTitle">{{ emptyTitle }}</h3>
      <p id="emptyDesc">{{ emptyDesc }}</p>
    </div>
  </section>
</template>
