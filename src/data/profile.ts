/**
 * Editorial copy for the home and about pages.
 *
 * Source of truth for the facts here is cv/main.tex. If a number changes there
 * (GPA, class rank, session count), change it here too; nothing derives one
 * from the other automatically.
 *
 * House rule inherited from the CV: no em-dashes in reader-facing prose. Use a
 * comma, a colon, a semicolon, or parentheses. En-dashes stay where they are
 * compounds or ranges (McCabe–Thiele, vapour–liquid, A1–B1).
 */

export interface Stat {
  value: string
  label: string
}

export interface Skill {
  name: string
  /** Free-text proficiency, rendered as-is. */
  level: string
}

export interface Hero {
  /** Small pill above the headline. Omit to hide it. */
  badge?: string
  /** Rendered as plain text on one line. */
  headlineLead: string
  /** Rendered in the accent gradient — the one place the gradient is used. */
  headlineAccent: string
  headlineTail?: string
  lede: string
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
}

export const hero: Hero = {
  // The headline is three fragments, one per line, so the badge carries the
  // context the words no longer do. The gradient falls on the middle line.
  badge: 'B.Sc. candidate, Shiraz University',
  headlineLead: 'Engineering,',
  headlineAccent: 'Biology,',
  headlineTail: 'Chemistry',
  lede: "I'm interested in bringing engineering practice and computational methods to problems that sit across biology and chemistry",
  primaryCta: { label: 'See the work', href: '/projects' },
  secondaryCta: { label: 'Resume', href: '/resume' },
}

/** Paragraphs for /about-me. Plain strings — no markup, no markdown. */
export const aboutParagraphs: readonly string[] = [
  'I am a Chemical Engineering undergraduate at Shiraz University. I like applying engineering principles to describe phenomena and optimize processes whose application is meaningful. From production of therapeutics to optimizing reactor setups and separation processes.',
  'During my undergrad years I’ve developed a taste for computational methods & computer programming and used it throughout my semesters in various projects. I also have hands on lab experience in a biochemistry laboratory in Rasht, working with biological samples; particularly enzymes and bio-markers. I also have research experience in the fields of bioprocess/systems biology and a little bit on CO2 capture.',
  'My interests sit at the intersection of process design and control and biology. More specifically, I like systems biology, synthetic biology and their intersection with process engineering. From novel ways to separate a desired metabolite to applying system theory for equipment control, my interests are growing in the direction of using micro-organisms as tools for reaching a desired purpose.',
]

/**
 * The research interests column, rendered on / beside the About prose and on
 * /about-me in the sidebar. One list, two pages: the alternative was a second
 * copy that quietly drifts, which is the whole reason copy lives in this file.
 *
 * Deliberately six areas and no proficiency labels. A level next to an interest
 * would claim a track record that an interest does not assert — that is what
 * `skills` below is for.
 */
export const researchInterests: readonly string[] = [
  'Computational Systems Biology',
  'Bioprocess Engineering & Industrial Biotechnology',
  'Process Modeling and Control',
  'Bioseparations & Product Recovery',
  'Transport Modeling',
  'Computational Chemical Engineering',
]

/**
 * CURRENTLY UNRENDERED. /about-me's sidebar showed these under "Focus areas"
 * until the research interests took that slot. Kept because it is the only
 * record of the proficiency framing, and deleting copy is easy to regret;
 * delete it if nothing has claimed it back.
 */
export const skills: readonly Skill[] = [
  { name: 'Transport phenomena & separations', level: 'Primary focus' },
  { name: 'COMSOL Multiphysics', level: 'Coupled 3-D models' },
  { name: 'MATLAB & numerical methods', level: 'Advanced' },
  { name: 'Thermodynamics & phase equilibrium', level: 'UNIFAC, VLE' },
  { name: 'Biochemical laboratory', level: 'Hands-on' },
  { name: 'Teaching & scientific writing', level: 'Ongoing' },
]

/** Closing line above the contact block, on /, /about-me, and /contact-me. */
export const contactPrompt = {
  heading: 'Get in touch',
  body: 'I am always glad to hear from people working on related problems. A question, an idea worth arguing about, a paper you think I should read: all of it is welcome.',
} as const

/**
 * The CV as a file. Lives in public/ so the URL is stable and the PDF is served
 * as-is rather than passing through the image pipeline. Built from cv/main.tex
 * by `bun run cv:build`, which also runs as part of `bun run deploy`.
 */
export const cvFile = {
  href: '/cv.pdf',
  /** Shown next to the download control so the weight is not a surprise. */
  label: 'PDF · 2 pages',
} as const

/**
 * Alt text for the portrait, in one place because two pages render it.
 *
 * Written for someone who cannot see it: what the photograph SHOWS and where,
 * not "photo of Afshin Ghorbani", which restates what the surrounding text
 * already says. The setting is the informative part.
 *
 */
export const portraitAlt =
  'Afshin Ghorbani in a white lab coat over a denim shirt, head and shoulders, standing in a laboratory corridor.'
