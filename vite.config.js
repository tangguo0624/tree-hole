import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' 保证构建产物可通过任意子路径或本地静态服务访问
export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    port: 5173,
    // 开发期把 /api 请求转发给 Hono 服务（server/index.js，默认 8787）
    proxy: {
      '/api': {
        target: process.env.API_ORIGIN || 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  }
})
