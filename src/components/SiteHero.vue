<script setup>
import { usePostsStore } from '../stores/posts'
import BrandWordmark from './BrandWordmark.vue'
// 品牌字样式独立成文件，避免与其他分支同时改 styles.css 造成冲突
import '../assets/brand.css'

const store = usePostsStore()
</script>

<template>
  <header class="hero">
    <p class="hero__badge">
      <span class="hero__badge-dot" aria-hidden="true"></span>
      匿名 · 只说给树洞听
    </p>

    <BrandWordmark />

    <p class="hero__subtitle">把心事交给安静的风</p>
    <p class="hero__count"><strong id="voiceCount">{{ store.totalCount }}</strong> 条声音已被收下</p>
  </header>
</template>
