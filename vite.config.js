import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' 保证构建产物可通过任意子路径或本地静态服务访问
export default defineConfig({
  plugins: [vue()],
  base: './'
})
