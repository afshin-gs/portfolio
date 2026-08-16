/**
 * The design system's variant vocabulary.
 *
 * These live in a .ts module rather than being exported from each .astro
 * frontmatter so they can be imported as types anywhere — including from other
 * .astro files, .ts helpers, and future framework islands — without depending
 * on how Astro compiles component exports.
 *
 * Adding a variant is a one-line change here plus one rule in the component's
 * scoped <style>. Anything that needs a wider change than that is a sign the
 * variant belongs in a new component instead.
 */

/** `article` is the long-form measure; `narrow` is for short centred content. */
export type ContainerSize = 'narrow' | 'article' | 'default' | 'wide'

/**
 * `accent` is a tinted outline, NOT the gradient. The gradient is reserved for
 * the hero headline and primary buttons; spraying it across every card would
 * spend the one emphasis the design has.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost'
export type ButtonSize = 'sm' | 'md'

/** `none` is for cards that manage their own inset — e.g. one with a
 * thumbnail that must sit flush in the corner. */
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export type TagTone = 'neutral' | 'accent'

export type BadgeTone = 'neutral' | 'accent' | 'warn'

export type GridGap = 'sm' | 'md' | 'lg'
