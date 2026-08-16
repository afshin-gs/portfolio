import type { APIRoute } from 'astro'
import { buildSearchIndex } from '../../lib/content'

// §10 — build-time search index for the filter island. Excludes drafts and
// isActive:false. A few KB at this scale, shipped whole.
export const GET: APIRoute = async () => {
  const records = await buildSearchIndex('projects')
  return new Response(JSON.stringify(records), {
    headers: { 'Content-Type': 'application/json' },
  })
}
