# CV

The typeset resume. LaTeX lives **only** in a Docker image. Nothing is
installed on the host.

## Files

| File           | Role                                                        |
| -------------- | ----------------------------------------------------------- |
| `main.tex`     | Root document: identity macros + content. **Edit this one.** |
| `imports.tex`  | `\usepackage` lines                                          |
| `configs.tex`  | Page setup, section styling, the `\cv*` commands             |
| `template.tex` | The original upstream template, kept for reference only      |
| `Dockerfile`   | scheme-basic TeX Live + exactly the packages above           |
| `build.sh`     | Runs `latexmk` in the container                              |
| `output/`      | `cv.pdf` and latexmk's aux files (git-ignored)               |

## Building

```sh
bun run cv:image   # one-off: build the Docker image (~1.7 GB, a few minutes)
bun run cv:build   # compile -> cv/output/cv.pdf and public/cv.pdf
```

`bun run cv:build` builds the image automatically the first time, so
`cv:image` is only needed to *rebuild* it after editing the `Dockerfile`.
`bun run deploy` runs `cv:build` before `astro build`, so the PDF in `public/`
is always current when Astro copies it into `dist/`. It is served at
[`/cv.pdf`](https://iamafshin.me/cv.pdf).

## Where the content comes from

`main.tex` is the **supervisor-first academic CV** ("Format B"), kept in sync
with `afshin_cv/afshin_ghorbani_supervisor.tex`. That repository is the source
of truth for the wording; this one is where the PDF gets published. Editing the
content means editing it there and re-porting the body here, or editing here and
carrying the change back.

Everything in the document traces to `afshin_cv/source_of_truth/opus.md`.
Nothing is embellished with dates, cohort sizes, or figures that were not in
that source. Keep it that way when you edit, and avoid em-dashes.

Deliberately absent until the open questions in `opus.md` close: the
internship supervisor's name, referees, and links to the two MATLAB libraries.
Nothing in the file is a placeholder.

## Four ways to build, one script

Everything below is a front-end for `cv/build.sh`: same container, same
flags, byte-identical PDF. Pick whichever is closest to hand.

| How                              | Where                             |
| -------------------------------- | --------------------------------- |
| `bun run cv:build`               | terminal                          |
| Save `main.tex`                  | LaTeX Workshop, on save           |
| `Ctrl+Shift+B`                   | `.vscode/tasks.json` (build task) |
| Run and Debug → **Build CV (PDF)** | `.vscode/launch.json`             |

The task and launch lists also carry **Rebuild CV (clean)** (discards stale
aux files) and **Rebuild CV LaTeX image** (after a `Dockerfile` edit).
`launch.json` additionally has **Build CV (PDF, no publish)**, which compiles
without overwriting `public/cv.pdf`.

The two build tasks parse latexmk's `-file-line-error` output into the
Problems panel, so a LaTeX error is clickable.

## Editing in VS Code

Install the recommended **LaTeX Workshop** extension. `.vscode/settings.json`
replaces its default `latexmk` tool with `cv/build.sh`, so:

- saving `main.tex` (or `imports.tex` / `configs.tex`) rebuilds via Docker;
- `Ctrl+Alt+V` opens `output/cv.pdf` in a tab, which refreshes on each build;
- SyncTeX works: the container mounts `cv/` at its host path so the recorded
  paths resolve.

## Adding a package

`\usepackage{foo}` also needs `foo` in the `tlmgr install` list in
`Dockerfile`, then `bun run cv:image`. The image is scheme-basic plus a
hand-picked list; it is not a full TeX Live, so a new package will not just be
there.

If a build fails with `File 'bar.sty' not found`, find its package with:

```sh
docker run --rm afshin-cv-latex:latest tlmgr search --global --file /bar.sty
```

## `cv/output/cv.pdf` is committed, `public/cv.pdf` is not

CI has no Docker step and is not getting one, so the compiled PDF has to come
from the repo. The split:

- **`cv/output/cv.pdf` is tracked.** It is the build artefact of record. Commit
  it alongside every `main.tex` change, or the deployed `/cv.pdf` goes stale.
- **`cv/output/*.aux`, `*.log`, `*.fls`, `*.fdb_latexmk`, `*.synctex.gz` are
  ignored.** Churn, not artefacts.
- **`public/cv.pdf` is ignored.** It is derived: `bun run build` runs
  `cv/publish.sh` first, which copies the tracked PDF into `public/` so Astro
  picks it up. Putting the copy inside `build` is what makes it impossible to
  produce a `dist/` without it.

If `cv/output/cv.pdf` is missing, `publish.sh` emits a GitHub Actions
`::warning::` and exits 0. The deploy still succeeds; `/cv.pdf` 404s until the
PDF is committed. Failing the whole deploy over one download link would be the
worse trade.
