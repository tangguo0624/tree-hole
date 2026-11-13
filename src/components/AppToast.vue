<script setup>
import { useToastStore } from '../stores/toast'

const toast = useToastStore()
</script>

<template>
  <div class="toast" :class="{ 'is-visible': toast.visible }" role="status" aria-live="polite">
    {{ toast.message }}
  </div>
</template>
