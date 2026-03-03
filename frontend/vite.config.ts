import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Single authoritative version source: root package.json
const rootPkg = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf-8')
) as { version: string }

const APP_VERSION = rootPkg.version

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Inject APP_VERSION as a compile-time constant so any file can use
  // `import.meta.env.VITE_APP_VERSION` without runtime fetches.
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
  },

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
