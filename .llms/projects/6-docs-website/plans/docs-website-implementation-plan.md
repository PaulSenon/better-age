# Plan: Better Age Docs Website

> Source PRD: [1-BETTER_AGE_DOCS_WEBSITE_PRD.md](../1-BETTER_AGE_DOCS_WEBSITE_PRD.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **App location**: the public site lives in `apps/website`.
- **Stack**: `Fumadocs + TanStack Start`.
- **Package manager**: use `pnpm` only for installs and workspace integration.
- **Bootstrap policy**: prefer latest official documentation and official scaffolders over manual setup whenever a good upstream scaffold exists.
- **Scaffolding approach**: initialize from the official `fumadocs` app scaffolder with `TanStack Start`, then adapt the generated project into the monorepo shape instead of hand-assembling all files.
- **Deployment target**: static deployment only. The production website must be hostable without an always-on application server.
- **Site split**: one app serves both:
  - custom home page at `/`
  - docs experience at `/docs/...`
- **Docs routing**: sectioned docs routes:
  - `/docs/getting-started/...`
  - `/docs/guides/...`
  - `/docs/integrations/...`
  - `/docs/reference/...`
- **Docs content model**: one single docs tree under the website app.
- **Content ownership**: the public website is the editorial source of truth; package READMEs stay concise and secondary.
- **Sidebar model**:
  - Getting Started
  - Guides
  - Integrations
  - Reference
- **Vision placement**: `Vision` lives inside the docs sidebar, not only in top-nav/global marketing pages.
- **Product model**: `better-age` is the primary product; `varlock` is documented as an integration surface, not a peer product.
- **Reference model**: one page per CLI command and one page per varlock API surface.
- **Search**: include strong docs search in the public site, using the capabilities supported cleanly by the chosen stack.
- **AI/export posture**: keep room for `llms.txt` and AI-friendly docs consumption surfaces where supported cleanly.
- **Versioning posture**: versioning must be possible later, but live versioning is explicitly out of scope for the initial implementation.

---

## Phase 1: Scaffold + Static Baseline

**User stories**: 20, 22, 23, 24, 25, 26, 34, 38

### What to build

Create the standalone website app in the monorepo using the latest official upstream scaffolding path, not a hand-rolled setup.

This slice should establish:
- the website app in `apps/website`
- the chosen stack (`Fumadocs + TanStack Start`)
- workspace/package-manager integration using `pnpm`
- static prerender/build baseline
- the top-level route contract for `/` and `/docs/...`
- one docs content tree wired into the generated site

This phase is successful when the repo has a generated website app that matches the agreed architecture and can produce a static output baseline.

### Acceptance criteria

- [ ] `apps/website` exists and is scaffolded from the latest official supported setup path rather than manually assembled from scratch.
- [ ] The scaffolded app is integrated into the monorepo using `pnpm`.
- [ ] The site supports the agreed top-level route split: `/` and `/docs/...`.
- [ ] The docs content source is wired as a single coherent docs tree.
- [ ] Static prerender/static build behavior is configured according to the official framework/docs guidance.
- [ ] The baseline app can be verified as a static site foundation without requiring an always-on server architecture.

---

## Phase 2: Public Shell - Home + Docs Index

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 19, 31, 32

### What to build

Build the two public entry surfaces:
- a custom marketing-like home page at `/`
- a sober docs entry page at `/docs`

The home page should establish the product pitch, positioning, and a clear path into the docs.

The docs index should act as a practical orientation layer:
- highlight the install/start command
- point to the main sections
- surface the most important next actions

This phase is successful when a first-time visitor can understand the product and reach the right docs path without digging through raw navigation.

### Acceptance criteria

- [ ] `/` presents a clear public-facing product introduction and a strong CTA into docs.
- [ ] `/docs` exists as a real entry page, not just a redirect.
- [ ] The docs index surfaces key sections and a practical starting point such as install/quickstart.
- [ ] The visual split between home and docs feels intentional while remaining one coherent site.
- [ ] A new visitor can move from home to docs and identify the next useful page quickly.

---

## Phase 3: Docs IA + Onboarding Slice

**User stories**: 9, 10, 11, 12, 13, 15, 23, 24, 33, 37

### What to build

Establish the shared docs layout and the first real documentation slice around onboarding.

This phase should land:
- the agreed sidebar information architecture
- `Vision` inside the docs sidebar
- the `Getting Started` section
- the first `Guides` pages needed to support onboarding

The initial page set should give users one coherent path from rationale to install to first useful workflow.

This phase is successful when the docs experience teaches the product in the intended order and the site navigation reflects the agreed IA in a stable way.

### Acceptance criteria

- [ ] The docs sidebar renders the agreed top-level sections in the correct order.
- [ ] `Vision`, `Installation`, and `Quickstart` are present inside `Getting Started`.
- [ ] The first `Guides` slice exists for the most important workflows.
- [ ] The docs layout is shared consistently across onboarding and guide pages.
- [ ] Users can move through the onboarding flow without leaving the docs experience or relying on package READMEs.

---

## Phase 4: Integration + Reference Publishing Model

**User stories**: 14, 16, 17, 18, 27, 36

### What to build

Establish the `Integrations` section and freeze the reference publishing contract.

This phase should land:
- the varlock integration docs page in `Integrations`
- the split between CLI reference and varlock plugin reference
- the first useful subset of per-command and per-API reference pages

This phase is successful when the site clearly communicates that varlock is an integration and when the reference section demonstrates the agreed granular model instead of giant catch-all pages.

### Acceptance criteria

- [ ] `Integrations` exists and presents varlock in the expected role.
- [ ] `Reference` is present in the same docs shell rather than a disconnected experience.
- [ ] CLI reference is split into separate command pages.
- [ ] Varlock reference is split into separate API/integration-surface pages.
- [ ] The first reference subset is deep-linkable and navigable from the sidebar and docs flow.

---

## Phase 5: Search + AI/Export Surfaces + Editorial Hardening

**User stories**: 21, 28, 29, 30, 34, 35

### What to build

Make the site feel like a strong modern docs surface rather than only a set of pages.

This phase should add:
- strong docs search appropriate for the chosen stack and static deployment target
- AI/export-friendly surfaces where supported cleanly, such as `llms.txt`
- editorial conventions that reinforce the website as the primary public docs source

This phase is successful when the site becomes easier to search, easier to consume by humans and AI tooling, and easier to maintain as the central public documentation source.

### Acceptance criteria

- [ ] Search works cleanly across the docs experience.
- [ ] The chosen AI/export surfaces are present if supported cleanly by the stack.
- [ ] The website clearly behaves as the primary public docs source.
- [ ] Package-level documentation can point to the site without duplicating the full public narrative.
- [ ] Editorial/documentation conventions are clear enough that future contributors can extend the site without rediscovering the IA.

---

## Phase 6: Reference Completion + Versioning Readiness Polish

**User stories**: 16, 17, 25, 26, 34, 38

### What to build

Complete the reference coverage and close the gaps that would make later versioning painful.

This phase should:
- finish the reference inventory for the CLI and varlock plugin
- close navigation and cross-linking gaps
- ensure the content structure, routes, and page granularity remain version-ready
- tighten any remaining inconsistencies in the docs taxonomy

This phase is successful when the site feels complete enough for a first public release and future versioning can be added later without restructuring the whole docs tree.

### Acceptance criteria

- [ ] The agreed reference scope is fully covered with one page per command/API surface.
- [ ] Navigation and search can reliably reach the full reference inventory.
- [ ] The docs taxonomy remains coherent as the reference section fills out.
- [ ] The site structure is still compatible with a future versioning layer without implementing one now.
- [ ] The docs website is ready for a credible first public release.
