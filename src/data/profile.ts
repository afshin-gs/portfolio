/**
 * Editorial copy for the home and about pages.
 *
 * Source of truth for the facts here is cv/main.tex. If a number changes there
 * (GPA, class rank, session count), change it here too; nothing derives one
 * from the other automatically.
 *
 * House rule inherited from the CV: no em-dashes in reader-facing prose. Use a
 * comma, a colon, a semicolon, or parentheses. En-dashes stay where they are
 * compounds or ranges (McCabe–Thiele, vapour–liquid, A2–B1).
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
  'I am an undergraduate chemical engineer at Shiraz University, expecting a B.Sc. in 2027. Most of what interests me sits where transport phenomena meet numerical methods: distillation and separations, coupled heat and mass transfer, phase equilibrium, and the models that claim to describe them.',
  'In practice that means writing the simulator rather than only solving the problem set. A McCabe–Thiele solver for multi-section columns with side streams and subcooled reflux. A UNIFAC-based vapour–liquid equilibrium library. A regression engine for Arrhenius and growth kinetics. A three-dimensional COMSOL model of evaporative cooling that put a number on how much the latent-heat term actually matters, which turned out to be about 14 percent of the predicted ten-minute temperature. The code is open source.',
  'Alongside the modelling I work in a biochemistry laboratory in Rasht, running catalase and malondialdehyde assays on tissue samples. I also teach: a term as teaching assistant for Thermodynamics I, volunteer sessions on material balances and fluid mechanics for petroleum engineering students, and twelve free English and German discussion sessions I organised and ran. I am applying to graduate programmes in North America.',
]

/**
 * The landing page's right-hand column, beside the About prose.
 *
 * Written as a SPACE rather than a list of specialisms: each line is one axis
 * of the same problem area, so any three of them read as a coherent research
 * programme rather than as unrelated interests. That is the point of the
 * column, and it is why these are broader than the `skills` list below, which
 * describes what is already demonstrable rather than what the work is aimed at.
 *
 * One column, no proficiency labels: a level next to an interest would claim a
 * track record that an interest does not assert.
 */
export const researchInterests: readonly string[] = [
  'Transport phenomena in chemical and biological systems',
  'Molecular simulation and multiscale modelling',
  'Reaction kinetics, catalysis, and enzyme engineering',
  'Bioprocess design, separations, and downstream processing',
  'Thermodynamics and phase behaviour of complex fluids',
  'Data-driven modelling and machine learning for molecular design',
  'Biomaterials, soft matter, and interfacial phenomena',
]

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
  body: 'I am applying to graduate programmes in North America. If you work on transport phenomena, separations, or computational modelling, I would be glad to hear from you.',
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
  'Afshin Ghorbani, head and shoulders, outdoors under a wooden veranda roof with trees behind him.'
