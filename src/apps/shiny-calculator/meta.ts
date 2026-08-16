import type { AppMeta } from '../../lib/apps'

/**
 * Auto-discovered by src/lib/apps.ts via import.meta.glob.
 * `slug` MUST equal this directory name — enforced at build time.
 */
export const meta: AppMeta = {
  slug: 'shiny-calculator',
  title: 'Shiny Calculator',
  description:
    'A keyboard-driven calculator. Built inside the website repo to prove the internal-app path; the primary path is a separate repo on its own Worker.',
  tags: ['react', 'internal'],
  status: 'live',
  accent: '#1d4ed8',
}
