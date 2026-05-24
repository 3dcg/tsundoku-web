import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// On GitHub Pages, the app is served from /tsundoku-web/, so assets need that base path.
// In dev (npm run dev), the base path is "/".
export default defineConfig(({ command }) => ({
  plugins: [svelte()],
  base: command === 'build' ? '/tsundoku-web/' : '/',
}))
