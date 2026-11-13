<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const visible = ref(false)

function handleScroll() {
  visible.value = window.scrollY > 80
}

function toTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function focusComposer() {
  const input = document.getElementById('postContent')
  if (!input) return
  input.scrollIntoView({ behavior: 'smooth', block: 'center' })
  input.focus({ preventScroll: true })
}

function toAbout() {
  document.getElementById('about')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <nav class="dock" :class="{ 'is-visible': visible }" aria-label="快捷导航">
    <button class="dock__item" type="button" data-action="top" @click="toTop">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4.6v-6.2H9.6V21H5a1 1 0 0 1-1-1v-9.4Z"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>回到洞顶</span>
    </button>

    <button class="dock__item dock__item--primary" type="button" data-action="compose" @click="focusComposer">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke-linecap="round" />
      </svg>
      <span>写一条</span>
    </button>

    <button class="dock__item" type="button" data-action="about" @click="toAbout">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 11v5.5M12 7.8h.01" stroke-linecap="round" />
      </svg>
      <span>关于</span>
    </button>
  </nav>
</template>
