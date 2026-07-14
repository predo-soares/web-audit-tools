import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: {
      // electron-store is pure ESM; bundling it inline lets esbuild convert it
      // to CJS rather than generating a require() call that Node can't fulfill.
      externalizeDeps: { exclude: ['electron-store'] }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          'pane-preload': resolve('src/preload/pane-preload.ts'),
          'panel-preload': resolve('src/preload/panel-preload.ts'),
          'safari-chrome-preload': resolve('src/preload/safari-chrome-preload.ts')
        }
      }
    }
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          overlay: resolve('src/renderer/overlay.html'),
          'safari-chrome': resolve('src/renderer/safari-chrome.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
