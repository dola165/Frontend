// Real Vite (instant reload, real map tiles) on the sandbox's synthetic data.
// Start the synthetic API first: node sandbox/server.mjs 4301
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

// Same flags as sandbox/build.mjs, minus its offline map and Overpass stand-ins.
Object.assign(process.env, {
  VITE_API_BASE_URL: '/api',
  VITE_ENABLE_MOCKS: 'false',
  VITE_GOOGLE_CLIENT_ID: 'sandbox-google-client',
  VITE_PAYMENT_PREVIEW: 'true',
})

const api = `http://localhost:${process.env.SANDBOX_PORT || 4301}`
const proxied = ['/api', '/uploads', '/media', '/sandbox-media', '/__guide', '/__mode']

export default mergeConfig(base, defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    proxy: Object.fromEntries(proxied.map(prefix => [prefix, api])),
  },
}))
