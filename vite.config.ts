import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Sistema-Iventario-de-Dados-/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})



