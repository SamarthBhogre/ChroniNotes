/// <reference types="vite/client" />

/**
 * Compile-time app version injected by vite.config.ts from the root
 * package.json.  Always matches the version in tauri.conf.json because
 * both files should be kept in sync.
 *
 * Usage:  import.meta.env.VITE_APP_VERSION
 */
interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
