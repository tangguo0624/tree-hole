import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    // 指定 http 源，否则 jsdom 处于不透明源（about:blank），localStorage 不可用
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/'
      }
    },
    include: ['tests/**/*.spec.js'],
    setupFiles: ['tests/setup.js']
  }
})
