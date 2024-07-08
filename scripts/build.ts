import { rename } from 'node:fs/promises'
import dts from 'bun-plugin-dts'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',
  external: ['ws', '@alicloud/pop-core'],
  plugins: [dts()]
})

await rename('dist/index.js', 'dist/index.mjs')