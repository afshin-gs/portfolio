/**
 * Site identity, navigation, and contact points.
 *
 * WHY THIS FILE EXISTS: nothing in `src/pages` or `src/components` should
 * hardcode a name, a nav label, or a URL. Chrome reads from here, so adding a
 * nav entry or changing the display name is one edit rather than a grep.
 *
 * Social entries are real profiles only. Scholar/ORCID are deliberately absent
 * until there is something to put behind them; the footer drops any '#' href at
 * build time, so a stub would render as nothing anyway.
 */

export interface NavItem {
  label: string
  /** Site-absolute path. Must match a real route — see docs §4 URL map. */
  href: string
}

export interface SocialLink {
  label: string
  href: string
}

export interface SiteConfig {
  name: string
  /** Short qualifier shown next to the name in the header. */
  role: string
  title: string
  description: string
  email: string
  location: string
  /** BCP-47 tag, underscored — the form `og:locale` expects (`en_US`, not `en-US`). */
  locale: string
  /**
   * X/Twitter handle WITH the `@`, or undefined. Only X reads it; it changes
   * nothing on Telegram, WhatsApp, or Facebook. Omit rather than invent one —
   * a handle that does not resolve gets the card attribution dropped.
   */
  twitter?: string
  nav: readonly NavItem[]
  socials: readonly SocialLink[]
  /** The single call-to-action in the header and hero. */
  cta: NavItem
}

export const site: SiteConfig = {
  name: 'Afshin Ghorbani',
  role: 'Chemical Engineering',
  title: 'Afshin Ghorbani',
  description:
    'Undergraduate chemical engineer at Shiraz University. Transport phenomena, numerical modelling, and biochemistry.',
  email: 'afshin.gs@proton.me',
  location: 'Shiraz, Iran',
  locale: 'en_US',

  nav: [
    { label: 'About', href: '/about-me' },
    { label: 'Projects', href: '/projects' },
    { label: 'Blog', href: '/blog' },
    { label: 'Apps', href: '/apps' },
    { label: 'Resume', href: '/resume' },
  ],

  socials: [
    { label: 'GitHub', href: 'https://github.com/afshin-gs' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/afshin-ghorbani-479455362/' },
    // Add ORCID and Google Scholar here once they resolve to something.
  ],

  cta: { label: 'Get in touch', href: '/contact-me' },
}

/** `<title>` for every page. One place, so the separator never drifts. */
export function pageTitle(title?: string): string {
  return title ? `${title} · ${site.name}` : site.title
}

/**
 * Marks the active nav entry. `/blog/some-post` highlights `/blog`, but `/`
 * only ever matches itself; otherwise the home link would light up everywhere.
 */
export function isActivePath(current: string, href: string): boolean {
  if (href === '/') return current === '/'
  const path = href.split('#')[0]!
  return current === path || current.startsWith(`${path}/`)
}
