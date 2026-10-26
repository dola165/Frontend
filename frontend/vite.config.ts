import { defineConfig, type Plugin } from 'vite'
import path from 'path'
import { execFileSync } from 'child_process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Libraries the first screen needs and that change far less often than the app. A file of their own stays
// cached across releases, so phones download only the app's own code again. Keep this to libraries the
// entry imports whole (not lucide-react or react-i18next, whose page-only parts would come along), or the first load grows.
const CORE_LIBRARIES = /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|axios|i18next|i18next-browser-languagedetector|sonner|use-sync-external-store|@react-oauth[\\/]google)[\\/]|commonjsHelpers/

// Each production build gets an id, in the bundle (__BUILD_ID__) and in /build.json, so a tab still running an older
// build notices a release and reloads into it (src/utils/buildVersion.ts). Development has none and never checks.
const BUILD_ID = process.env.GK_BUILD_ID || `${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`
const buildId = (): Plugin => ({
  name: 'gk-build-id',
  config: (_, { command }) => ({ define: { __BUILD_ID__: JSON.stringify(command === 'build' ? BUILD_ID : '') } }),
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'build.json', source: JSON.stringify({ id: BUILD_ID }) }) },
})

// The branch and last 150 commits of this repository, in the bundle (__GIT_HISTORY__) for Team work's "What changed"
// page and the commits a task key links to. Without .git or git (a Docker build) it says {known:false}; nothing calls GitHub at runtime.
const gitHistory = (): Plugin => {
  const git = (...args: string[]) => {
    try { return execFileSync('git', args, { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null }
  }
  const log = git('log', '-150', '--format=%H%x1f%cI%x1f%an%x1f%P%x1f%s%x1e')
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD')?.trim()
  const history = log == null || !branch ? { known: false } : {
    known: true,
    branch,
    commits: log.split('\u001e').map(line => line.trim()).filter(Boolean).map(line => {
      const [id, date, author, parents, title] = line.split('\u001f')
      return { id, date, author, title, merge: parents.trim().includes(' ') }
    }),
  }
  // Beside it (__GIT_BUILD__): the commit this bundle or dev server was made from, when, how many files had
  // uncommitted changes, and the last 1000 commits with their parents ("id parent parent", 12 characters each), so
  // "What changed" can tell which release this copy contains. Taken once, at build or dev-server start.
  const head = git('rev-parse', 'HEAD')?.trim()
  const graph = git('log', '-1000', '--format=%H %P')
  const dirty = git('status', '--porcelain', '--untracked-files=no')
  const build = head == null || graph == null || !branch ? { known: false, builtAt: new Date().toISOString() } : {
    known: true,
    head,
    branch,
    builtAt: new Date().toISOString(),
    dirty: (dirty ?? '').split('\n').filter(line => line.trim()).length,
    graph: graph.split('\n').map(line => line.trim()).filter(Boolean).map(line => line.split(' ').map(id => id.slice(0, 12)).join(' ')),
  }
  return { name: 'gk-git-history', config: () => ({ define: { __GIT_HISTORY__: JSON.stringify(history), __GIT_BUILD__: JSON.stringify(build) } }) }
}

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [
    react(),
    tailwindcss(),
    buildId(),
    gitHistory(),
  ],
  build: {
    manifest: true,
    rollupOptions: { output: { manualChunks: id => (CORE_LIBRARIES.test(id) ? 'vendor' : undefined) } },
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
      allowedHosts: ['app.grasskickz.com', 'grasskickz.com'],
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
