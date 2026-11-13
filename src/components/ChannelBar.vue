<script setup>
import { computed } from 'vue'
import { usePostsStore, CHANNELS } from '../stores/posts'

const store = usePostsStore()

const tabs = computed(() => [{ id: 'all', label: '全部' }, ...CHANNELS])
</script>

<template>
  <nav class="feedbar" aria-label="频道切换">
    <div class="feedbar__tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="feedbar__tab"
        :class="{ 'is-active': store.activeChannel === tab.id }"
        type="button"
        role="tab"
        :aria-selected="store.activeChannel === tab.id ? 'true' : 'false'"
        :data-channel="tab.id"
        @click="store.setChannel(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
    <span class="feedbar__count" id="feedCount" aria-live="polite">{{ store.channelCount }} 条</span>
  </nav>
</template>
