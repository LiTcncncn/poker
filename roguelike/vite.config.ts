import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/dist/rg/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../dist/rg',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
})
