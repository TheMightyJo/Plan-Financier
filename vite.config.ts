/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Correspondances exactes par paquet : une règle trop large
          // (« includes('jspdf') ») attrapait un module partagé et forçait
          // le préchargement du PDF sur la vitrine.
          // recharts / jspdf : pas de chunk forcé — le bundler les isole
          // naturellement derrière leurs imports dynamiques (un chunk forcé
          // attirait des helpers partagés et se retrouvait préchargé par la
          // vitrine).
          if (id.includes('/node_modules/')) {
            if (id.includes('/node_modules/@supabase/')) return 'supabase'
            if (id.includes('/node_modules/lucide-react/')) return 'icons'
          }
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
