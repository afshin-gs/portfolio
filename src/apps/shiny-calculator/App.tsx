// Convention: every internal app exposes its root component as the default
// export of App.tsx. src/pages/apps/[slug].astro globs for exactly this path,
// which is what makes internal apps auto-routed as well as auto-listed.
import './calculator.css'
export { default } from './Calculator'
