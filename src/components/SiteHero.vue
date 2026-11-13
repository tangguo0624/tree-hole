<script setup>
import { usePostsStore } from '../stores/posts'

const store = usePostsStore()
</script>

<template>
  <header class="hero">
    <p class="hero__badge">
      <span class="hero__badge-dot" aria-hidden="true"></span>
      匿名 · 只存在本地
    </p>

    <div class="hero__title-wrap">
      <h1 class="hero__title">树洞</h1>
      <svg class="hero__swoosh" viewBox="0 0 240 18" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="swooshGrad" x1="0" y1="0" x2="240" y2="0">
            <stop stop-color="#A8CC8B" />
            <stop offset="1" stop-color="#6E9C55" stop-opacity="0.15" />
          </linearGradient>
        </defs>
        <path d="M5 12c32-7 72-10 113-7 40 3 78 8 117 2" stroke="url(#swooshGrad)" stroke-width="7" stroke-linecap="round" />
      </svg>
    </div>

    <p class="hero__subtitle">把心事交给安静的风</p>
    <p class="hero__count"><strong id="voiceCount">{{ store.totalCount }}</strong> 条声音已被收下</p>
  </header>
</template>
