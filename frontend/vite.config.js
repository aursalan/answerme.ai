import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),
  ],
  
  // This server block is ESSENTIAL for the API calls to work.
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Your Python backend URL
        changeOrigin: true,
      },
    },
  },
})
