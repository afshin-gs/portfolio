# Documentation

Reference documentation for `iamafshin.me` and its satellite apps.

| Document | Purpose |
|---|---|
| [architecture.md](./architecture.md) | System design, decision record, deployment, CI/CD, scope. The single source of truth |

## How to read `architecture.md`

It is a reference, not a tutorial — jump to what you need:

- **Why is it built this way?** → §2, the decision record. Eleven numbered
  decisions (D1–D11), each with rationale, alternatives considered, and the cost
  accepted. Reference and supersede them by number rather than re-arguing them.
- **What are the moving parts?** → §3 topology, §4 URL map, §5 repositories.
- **How do I add a post, a project, or an app?** → §18 runbooks.
- **What is deliberately excluded?** → §16. Every out-of-scope item carries a
  reason, so revisiting one is a deliberate act.
- **What might still bite?** → §17. R1 and R2 are resolved; R3–R6 remain open
  risks with mitigations.

## Status

Design is complete and both blockers are cleared:

- **R1** — Cloudflare route precedence. Verified empirically against the live
  zone on 2026-07-26. A path route beats an apex custom domain, so independent
  per-app deploys (D2) work as designed. The spike also forced D10, which
  changed the app route pattern and build layout from what was first assumed.
- **R2** — Charting library. Decided as Apache ECharts (D11) on stated criteria;
  no empirical comparison was run.

## Implementation

The Astro site is scaffolded and the content pipeline is verified end to end:
schemas, MDX rendering with math/code/callouts, element overrides, derived
routing, tag facets, search-index endpoints, and a lazy-loaded ECharts island.

```
bun dev      # dev server
bun run build
bun run check   # types + content schema validation
```

`src/content/blog/pipeline-smoke-test.mdx` exercises every mechanism in §8 at
once. Delete it once real content exists.

Not yet built: the filter/search island (§10), the theme toggle UI, RSS,
`/about-me`, `/resume`, `/apps`, and the deploy workflow.
