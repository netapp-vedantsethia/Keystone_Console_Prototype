import fs from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

/** Resolve `figma:asset/<file>` to `src/assets/<file>` when present, else `figma-placeholder.png`. */
function figmaAssetPlugin(): Plugin {
  const placeholder = path.resolve(__dirname, 'src/assets/figma-placeholder.png')
  return {
    name: 'resolve-figma-asset',
    enforce: 'pre',
    resolveId(id) {
      if (!id.startsWith('figma:asset/')) return
      const filename = id.slice('figma:asset/'.length)
      const candidate = path.resolve(__dirname, 'src/assets', filename)
      if (fs.existsSync(candidate)) return candidate
      return placeholder
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetPlugin(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    port: 8080,
  },
})
