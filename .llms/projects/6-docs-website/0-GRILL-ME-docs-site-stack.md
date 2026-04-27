# Grill Session: Docs Site Stack

## Turn 1

- User goal: kick off docs/public website for CLI + Varlock plugin in monorepo.
- Constraints surfaced:
  - simple commercial home page
  - full docs + reference site
  - docs split by lib: CLI and Varlock plugin
  - versioned docs
  - some global pages: vision / positioning vs competitors
  - wants easy maintenance + fast iteration
  - dislikes Docusaurus
  - narrowed choice to Starlight vs Fumadocs
  - current leaning: Fumadocs

## Research Notes

- Fumadocs official docs confirm static export support via Next.js `output: 'export'`.
- Fumadocs official docs confirm versioning is primitives / DIY:
  - partial versioning via folders/tabs
  - full versioning via separate deployed app / branch / subdomain
- Starlight remains strong for content-first Astro docs, but versioning is not the stronger official story compared to Fumadocs flexibility.

## Current Working Hypothesis

- Fumadocs is likely the better fit if the team accepts:
  - Next.js app instead of Astro
  - custom versioning architecture instead of built-in versioning workflow

## Turn 2

- User decision: versioning should be ready later, not fully live from day 1.

## Implication

- Initial site can ship with a single current docs corpus.
- Information architecture should still reserve clean paths for future versioning.
- Avoid branch-per-version / subdomain-per-version / version switcher work in initial scaffold.

## Turn 3

- User decision: one site app.
- Desired top-level experience:
  - custom marketing-like home page
  - docs site
  - references per product
- Open IA note from user:
  - reference may share same docs layout rather than being a separate experience

## Current IA Lean

- Keep one visual shell for docs/reference.
- Keep custom marketing treatment limited to home and maybe a few global pages.

## Turn 4

- User proposed docs-first sidebar:
  - Getting Started
    - Vision
    - Installation
    - Usage
  - Guides
    - First time setup
    - Create
    - Share
    - Revoke
    - Load
  - Plugins
    - Varlock
  - References
    - CLI
    - Varlock plugin

## Repo Context Check

- README positions:
  - `@better-age/cli` as main product
  - `@better-age/varlock` as thin varlock plugin adapter
- Vision says varlock integration is a major motivation, but still integration-shaped rather than a peer standalone product.

## IA Consequence

- Product-first top-level docs is probably wrong for v1.
- Task-first docs with product-specific reference sections fits better:
  - users learn one main workflow
  - plugin is introduced as integration surface
  - CLI and plugin APIs still get separate reference entries

## Turn 5

- User confirmed sidebar shape is right.
- User decision: `Vision` must live inside docs sidebar, not just top nav.

## Package Docs Context

- `packages/cli/README.md` is a concise package summary plus command overview.
- `packages/varlock/README.md` is a concise integration/contract summary.
- Both already read like package-local READMEs, not like a full public docs source.

## Consequence

- Public docs site should likely own the full narrative docs.
- Package READMEs can stay short and point toward the site rather than become the source of truth for all docs pages.

## Turn 6

- User decision: public site should be a standalone app in the monorepo.
- User decision: docs/reference should not pretend to be auto-generated from source code.

## Consequence

- Site is the editorial source of truth.
- Reference should be hand-authored / curated reference, not API-doc-generator theater.
- Keep room for small generated fragments later only if a narrow contract becomes machine-readable.

## Turn 7

- User decision: docs live under `/docs/...`

## Turn 8

- User decision: one single docs content tree

## Consequence

- Avoid Fumadocs workspace complexity for v1.
- Use one coherent sidebar + one coherent docs layout.
- `Integrations` and `Reference` stay as sections inside same content tree, not separate roots.

## Turn 9

- User decision: `/docs` should be a simple real landing page with key entry points and important snippets like install command.

## Turn 10

- User constraint: does not want a non-static runtime website.
- User asks whether Fumadocs can be used with something better designed than Next for static sites.
- User asks for realistic alternatives: TanStack Start, others.

## Constraint Upgrade

- "No server required in production" is now a hard constraint.
- Framework recommendation must optimize for static hosting first, not just docs DX.

## Turn 11

- User provisional choice: `Fumadocs + TanStack Start + static`

## Risk Note

- TanStack Start official docs still describe the framework as RC.
- For a static docs site, this choice brings more app-framework surface area than obviously needed.
- This is viable, but not the lowest-risk / lowest-maintenance Fumadocs path.

## Turn 12

- User hard constraints refined:
  - Vite-based
  - static
  - not React Router
- This pushed recommendation toward `Starlight` rather than forcing Fumadocs.

## Turn 13

- User concern: Starlight may be too basic and not feature-packed enough for:
  - nice search
  - page versions
  - llm copy/page export style features
  - llms.txt
  - generally polished docs UX

## Current Assessment

- Starlight is intentionally thinner in core than Fumadocs.
- But it is not barebones:
  - built-in static full-text search via Pagefind
  - official Algolia DocSearch plugin
  - built-in code UX via Expressive Code
  - MD / MDX / Markdoc support
  - component overrides and theming
  - edit links / last updated / SEO / i18n
- Weakest point for this project:
  - versioning is ecosystem/community territory, not strong official core story
- Strongest point:
  - static-content architecture with Astro ergonomics and low runtime baggage

## Turn 14

- User final decision: use `Fumadocs + TanStack Start`
- User explicitly wants framework debate closed

## Locked Stack

- Docs/public website stack is now fixed:
  - Fumadocs
  - TanStack Start
  - static deployment target

## Turn 15

- User decision: app location will be `apps/website`

## Turn 16

- User decision: use sectioned docs routes:
  - `/docs/getting-started/...`
  - `/docs/guides/...`
  - `/docs/integrations/...`
  - `/docs/reference/...`

## Turn 17

- Assumed user decision from "ok": docs content path will be `apps/website/content/docs/...`
- User decision: reference uses one page per command / API surface, not one giant page per product
