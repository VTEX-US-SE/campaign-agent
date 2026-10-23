import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { ASSETS_DIR } from './store.js'

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export function publicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8009}`).replace(/\/$/, '')
}

/** Stores a generated image and returns the URL it is served from (`/assets/:file`). */
export async function saveAsset(data: Buffer, mimeType: string, prefix: string) {
  const file = `${prefix}-${randomUUID()}.${EXTENSIONS[mimeType] ?? 'png'}`
  const localPath = path.join(ASSETS_DIR, file)
  await fs.writeFile(localPath, data)
  return { file, localPath, url: `${publicBaseUrl()}/assets/${file}` }
}
