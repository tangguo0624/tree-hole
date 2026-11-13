import { defineStore } from 'pinia'

export const TOAST_DURATION = 2400

export const useToastStore = defineStore('toast', {
  state: () => ({
    message: '',
    visible: false,
    timer: null
  }),

  actions: {
    show(message, duration = TOAST_DURATION) {
      this.message = message
      this.visible = true

      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => {
        this.visible = false
      }, duration)
    },

    hide() {
      if (this.timer) clearTimeout(this.timer)
      this.timer = null
      this.visible = false
    }
  }
})
