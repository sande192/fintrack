import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ⚠️  Change 'fintrack' to your actual GitHub repo name
  base: '/fintrack/',
})
