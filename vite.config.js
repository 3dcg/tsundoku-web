import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// ビルドごとに一意なID。アプリに埋め込み(__BUILD_ID__)、同じ値を version.json にも出力する。
// 実行中のアプリが定期的に version.json を取得し、値が変わっていたら新しい版が出たと判断する。
const BUILD_ID = String(Date.now())

// On GitHub Pages, the app is served from /tsundoku-web/, so assets need that base path.
// In dev (npm run dev), the base path is "/".
export default defineConfig(({ command }) => ({
  plugins: [
    svelte(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ buildId: BUILD_ID }),
        })
      },
    },
  ],
  base: command === 'build' ? '/tsundoku-web/' : '/',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
}))
