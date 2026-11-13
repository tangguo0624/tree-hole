<script setup>
import { usePostsStore } from './stores/posts'
import SiteHero from './components/SiteHero.vue'
import ChannelBar from './components/ChannelBar.vue'
import Composer from './components/Composer.vue'
import PostList from './components/PostList.vue'
import AppDock from './components/AppDock.vue'
import AppToast from './components/AppToast.vue'

const store = usePostsStore()

// load 内部已降级处理，这里再兜底一次，避免未处理的 rejection
store.load().catch((error) => {
  console.warn('[树洞] 首次加载失败。', error)
})
</script>

<template>
  <div class="backdrop" aria-hidden="true">
    <span class="backdrop__blob backdrop__blob--mint"></span>
    <span class="backdrop__blob backdrop__blob--sage"></span>
    <span class="backdrop__blob backdrop__blob--cream"></span>
    <span class="leaf leaf--a"></span>
    <span class="leaf leaf--b"></span>
    <span class="leaf leaf--c"></span>
  </div>

  <div class="page">
    <SiteHero />

    <main>
      <ChannelBar />
      <Composer />
      <PostList />
    </main>

    <footer class="site-footer" id="about">
      <p>内容保存在树洞的小屋里，不会同步到任何社交平台。</p>
      <p class="site-footer__meta">Tree Hole · Vue 3 / Pinia / Hono REST</p>
    </footer>
  </div>

  <AppDock />
  <AppToast />
</template>
