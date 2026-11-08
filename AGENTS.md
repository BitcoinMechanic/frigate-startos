# AGENTS.md

This is a StartOS service-package repository — it builds a `.s9pk` for StartOS.

Develop it inside a StartOS packaging workspace created by `start-cli s9pk init-workspace`,
which provides the packaging guide and agent context one level up. If you're reading this in a
bare clone with no workspace, the full guide is at <https://docs.start9.com/packaging>.

**Start every task at the recipe index** — `../start-technologies/projects/start-sdk/docs/src/recipes.md`
(or <https://docs.start9.com/packaging/recipes.html>). It maps an intent ("prompt the user to create
admin credentials", "expose a web UI") to the constructs, the reference pages, and a named production
package to copy. Find the recipe before you read this package's neighbours: a package you reach by
grepping may be non-conformant, and the recipe outranks it.

Freshly scaffolded? Work the
[New Package Checklist](../start-technologies/projects/start-sdk/docs/src/new-package-checklist.md)
(or <https://docs.start9.com/packaging/new-package-checklist.html>) from top to bottom. It is a
guide page, not a file in this repo — read it, don't copy it in.

Keep `README.md` (technical reference for an AI support or administering agent) and
`instructions.md` (end-user docs) in sync with your changes. This file restates neither:
whoever changes the package has both, so it carries only what they don't — repo mechanics,
a change that looks right and is not, where the next thing gets added, a naming trap, a
build or test invocation particular to this repo.

**Fix a defect you spot rather than reporting it** — you have the package open and the
context to be sure. File **a GitHub issue on this repo** only when the call isn't yours to
make: you can't pin the cause down, two defensible fixes exist, or it's too large to ride on
the work in hand. An open issue is a report, not a queue — implement one when you're asked
to or when it's labelled `Approved`, then close it with `Closes #<n>`.

Don't record work in the repo instead: no `TODO.md`, no `NOTES.md`, no `PLAN.md`. What you
verified, tried, and decided belongs in the commit message and the PR body.

## This repo

- **This is Sparrow Wallet's Frigate, an Electrum server — not the Frigate NVR project.** Every search result for "Frigate Docker" is the NVR. Verify against <https://github.com/sparrowwallet/frigate> before acting on anything you read elsewhere.
- **Three build variants share one package id.** `VARIANT` (`generic` / `nvidia` / `amd`) selects the image and the hardware requirement in `startos/manifest/index.ts`; the `Makefile`'s `TARGETS` fans them out one s9pk per variant-arch, and CI builds all four leaves. An unrecognised `VARIANT` throws rather than silently packing the generic image — keep it that way. Build one locally with `make generic-x86` / `make nvidia-x86` / `make amd-x86`; bare `make x86` builds the generic image under the unsuffixed name.
- **The BLAKE2b Dockerfile replaces the application in each base image.** Keep its pinned Frigate and Drongo sources and the raw-header patch in sync when updating; switching the manifest back to `dockerTag` silently removes BLAKE2b support.
- **The `amd` variant uses the `-rocm` base image, not `-amd`.** `remcoros/frigate-docker` publishes both (`-amd` is Mesa Rusticl, `-rocm` is TheRock's ROCm OpenCL); this package ships ROCm. Don't "fix" the tag to match the variant name.
- **`startos/utils.ts` exists for dependents**, not for this package — it exports the Electrum host id and container port so another package can resolve Frigate over the bridge without a literal.
