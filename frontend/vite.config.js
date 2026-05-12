import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const frontendDir = path.resolve(__dirname)
  const frontendEnv = loadEnv(mode, frontendDir, '')
  const backendEnv =
    mode === 'development' ? loadEnv(mode, path.resolve(frontendDir, '../backend'), '') : {}
  const accountDefaultPriceId =
    frontendEnv.VITE_ACCOUNT_DEFAULT_PRICE_ID?.trim() ||
    backendEnv.STRIPE_PRICE_ID?.trim() ||
    ''

  return {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.VITE_ACCOUNT_DEFAULT_PRICE_ID': JSON.stringify(accountDefaultPriceId),
    },
  }
})