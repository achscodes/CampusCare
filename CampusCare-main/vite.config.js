import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    warmup: {
      clientFiles: [
        './src/main.jsx',
        './src/App.jsx',
        './src/pages/LandingPage.jsx',
      ],
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react-router',
      'react-router-dom',
      '@supabase/supabase-js',
      'lucide-react',
      'zustand',
    ],
  },
})
