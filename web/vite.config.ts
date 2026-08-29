import react from '@vitejs/plugin-react'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // This repo lives inside a Dropbox-synced folder, which locks files in
  // node_modules/.vite mid-sync (EBUSY on the dep-optimizer's rename) and
  // breaks `npm run dev`. Keeping the cache outside the synced tree avoids
  // the contention entirely; it's local dev-server scratch space, not
  // anything that needs to be shared or committed.
  cacheDir: join(tmpdir(), 'aliquot-vite-cache'),
})
