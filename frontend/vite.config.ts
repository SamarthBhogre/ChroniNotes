import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Smaller chunk size threshold for better lazy-loading
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Isolate TipTap + editor deps into their own chunk
          // Only loaded when Notes page is opened
          'editor': [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-code-block-lowlight',
            '@tiptap/extension-font-family',
            '@tiptap/extension-text-style',
            '@tiptap/extension-placeholder',
          ],
          // Isolate lowlight (syntax highlighting) separately
          'syntax': [
            'lowlight',
          ],
          // State management
          'vendor-state': [
            'zustand',
          ],
        },
      },
    },
    // Use esbuild (Vite default) — fast + no extra dependency
    minify: 'esbuild',
    target: 'es2021',
  },
  // Reduce dev server memory footprint
  server: {
    hmr: {
      overlay: true,
    },
  },
})
