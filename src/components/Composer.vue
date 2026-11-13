<script setup>
import { computed, ref } from 'vue'
import { usePostsStore, MAX_LENGTH, WARN_THRESHOLD, CHANNELS } from '../stores/posts'
import { useToastStore } from '../stores/toast'

const store = usePostsStore()
const toast = useToastStore()

const draft = ref('')

const charCount = computed(() => draft.value.length)
const submitting = computed(() => store.publishing)
const canSubmit = computed(() => draft.value.trim().length > 0 && !submitting.value)
const counterText = computed(() => `${charCount.value} / ${MAX_LENGTH}`)

function selectChannel(id) {
  store.setComposerChannel(id)
}

async function handleSubmit() {
  if (!canSubmit.value) return

  const published = await store.publish(draft.value)
  if (!published) {
    toast.show('保存失败，请稍后再试')
    return
  }

  draft.value = ''
  toast.show('已投进树洞，叶子替你说完了')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <form class="composer" id="composerForm" novalidate @submit.prevent="handleSubmit">
    <div class="composer__head">
      <span class="composer__avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none">
          <path
            d="M19.5 3.5c-8.2 0-13.6 4.2-13.6 11 0 1.9.6 3.5 1.6 4.8 3-6 7.2-9.6 12.2-11.6-4.2 3-7.4 6.4-9.4 11.4 1.1.5 2.3.7 3.6.7 6.2 0 9.6-6.2 9.6-16.3Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <label class="composer__label" for="postContent">这一刻，想说什么？</label>
    </div>

    <div class="composer__channels" role="group" aria-label="选择投向的频道">
      <span class="composer__channels-label">投向</span>
      <button
        v-for="channel in CHANNELS"
        :key="channel.id"
        class="chip"
        :class="{ 'is-active': store.composerChannel === channel.id }"
        type="button"
        :data-channel="channel.id"
        @click="selectChannel(channel.id)"
      >
        {{ channel.label }}
      </button>
    </div>

    <textarea
      id="postContent"
      v-model="draft"
      name="content"
      rows="3"
      :maxlength="MAX_LENGTH"
      placeholder="这里没有熟人，说说今天的事……"
      @keydown.ctrl.enter.prevent="handleSubmit"
      @keydown.meta.enter.prevent="handleSubmit"
    ></textarea>

    <div class="composer__footer">
      <span class="char-count" id="charCount" :class="{ 'is-warn': charCount >= WARN_THRESHOLD }" aria-live="polite">
        {{ counterText }}
      </span>
      <button class="btn-primary" id="submitBtn" type="submit" :disabled="!canSubmit">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
          <path
            d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3Z"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>投进树洞</span>
      </button>
    </div>
  </form>
</template>
