# Better Age Docs Website PRD

## Problem Statement

`better-age` now has product intent, package-level READMEs, and internal design documents, but it does not yet have a coherent public website that explains the product clearly, sells the product credibly, and documents the CLI and varlock integration in one maintainable place.

The current state has several gaps:
- no proper public-facing home page
- no unified docs experience
- no curated reference site for the CLI and varlock plugin
- no strong onboarding flow from product pitch to installation to first success
- no public documentation information architecture that matches the actual product shape
- no standalone website app inside the monorepo that can evolve independently from package READMEs

The problem is not “write more markdown.” The problem is:
- define one durable public docs architecture
- choose one stack and one authoring model
- create a docs structure that matches how users learn this product
- leave room for future versioning without paying the cost now

## Solution

Create one standalone public website app for `better-age`, built with `Fumadocs + TanStack Start`, targeting static deployment.

The site should combine:
- a custom marketing-like home page at `/`
- a docs entry page at `/docs`
- one coherent docs/reference experience under `/docs/...`

The docs experience should be task-first and product-honest:
- `better-age` is the main product
- `varlock` is an integration surface, not a separate peer product
- `Vision` belongs inside the docs sidebar because it is part of onboarding and positioning, not only a marketing essay
- `Reference` stays inside the same docs layout, not as a separate site or disconnected section

The initial docs architecture should be:
- Getting Started
- Guides
- Integrations
- Reference

The initial build should optimize for:
- static hosting
- easy editorial iteration
- one coherent sidebar
- hand-authored narrative docs
- hand-authored curated reference pages
- future versioning readiness without implementing live version switching yet

## User Stories

1. As a first-time visitor, I want a clear home page, so that I understand what `better-age` is before I enter the docs.
2. As a first-time visitor, I want the home page to feel polished and intentional, so that the product feels credible.
3. As a prospective user, I want the site to explain the product bet clearly, so that I know why this exists instead of using a broader secrets tool.
4. As a prospective user, I want the site to show where `better-age` fits relative to adjacent tools, so that I can place it among competitors.
5. As a developer, I want one docs entry point, so that I do not have to choose between scattered READMEs and internal notes.
6. As a developer, I want the docs entry page to highlight the most important starting actions, so that I can get moving fast.
7. As a developer, I want installation information to be easy to find, so that I can try the tool immediately.
8. As a developer, I want a short quickstart flow, so that I can reach first success before reading the entire product philosophy.
9. As a developer, I want `Vision` inside the docs sidebar, so that I can understand the product rationale in the same flow as onboarding.
10. As a developer, I want the docs sidebar to stay stable and predictable, so that I can learn the site once and navigate quickly later.
11. As a developer, I want the docs organized by learning/job-to-be-done first, so that the site matches how I actually adopt the tool.
12. As a developer, I want a `Getting Started` section, so that I can move from context to install to first use in one path.
13. As a developer, I want a `Guides` section, so that common workflows like create, share, revoke, and load are taught as concrete tasks.
14. As a developer, I want an `Integrations` section, so that I can understand how varlock fits into the core workflow.
15. As a developer, I want a `Reference` section, so that I can look up exact command or API behavior after I understand the concepts.
16. As a developer, I want reference pages split per command or API surface, so that deep links are precise and pages stay scannable.
17. As a developer, I want the CLI reference to be separate from the varlock plugin reference, so that each surface remains understandable.
18. As a developer, I want varlock documentation presented as an integration, so that I do not mistake it for the main product surface.
19. As a developer, I want the docs and reference to share one visual shell, so that the whole site feels coherent.
20. As a maintainer, I want the public docs to be authored centrally in the website app, so that package READMEs do not become overloaded.
21. As a maintainer, I want package READMEs to stay concise, so that npm/GitHub summaries and public docs each have a clear role.
22. As a maintainer, I want the website to be a standalone app in the monorepo, so that it can evolve independently from library packaging concerns.
23. As a maintainer, I want one docs content tree, so that authoring stays simple and the sidebar remains coherent.
24. As a maintainer, I want sectioned URLs under `/docs/...`, so that the route model matches the sidebar model and future growth stays clean.
25. As a maintainer, I want future versioning to be possible, so that the site can eventually support released docs without a rewrite.
26. As a maintainer, I do not want to implement live versioning now, so that the initial project stays focused and shippable.
27. As a maintainer, I want the docs site to remain hand-authored instead of fake-generated from source code, so that the content stays honest and curated.
28. As a maintainer, I want search to work well on a static site, so that users can reach the right page quickly.
29. As a maintainer, I want AI-facing site artifacts such as `llms.txt` to be possible, so that the docs can be consumed well by LLM tooling.
30. As a maintainer, I want docs pages to be easy to copy and share, so that humans and AI assistants can reuse the content efficiently.
31. As a maintainer, I want the home page to stay intentionally small in scope, so that the project remains docs-first rather than turning into a marketing redesign project.
32. As a maintainer, I want the docs index page to surface key actions and commands, so that it acts as a practical orientation layer rather than empty ceremony.
33. As a maintainer, I want the information architecture to reflect the actual product stance, so that users learn the narrow workflow instead of a generic secrets platform story.
34. As a maintainer, I want the site architecture to support fast iteration, so that docs and positioning can evolve quickly as the product sharpens.
35. As a maintainer, I want the docs stack to support rich docs UX, so that the site can feel feature-complete and modern rather than bare.
36. As a maintainer, I want the initial docs set to cover the most important journeys first, so that the first release is useful before the full reference is complete.
37. As a maintainer, I want the docs structure to be legible to future contributors, so that adding pages does not require rediscovering the intended IA.
38. As a reviewer, I want the PRD to freeze the website scope and IA decisions, so that implementation does not reopen the same stack and structure debates repeatedly.

## Implementation Decisions

- Build one standalone website app inside the monorepo.
- Use `Fumadocs + TanStack Start`.
- Target static deployment. The production site must not require an always-on application server.
- Split the site into two main user-facing surfaces:
  - a custom home page at `/`
  - the docs experience under `/docs/...`
- Keep one coherent docs shell for onboarding, guides, integrations, and reference.
- Keep the docs content in one single docs tree rather than separate workspaces or multiple disconnected content roots.
- Use a sectioned URL and IA model:
  - `/docs/getting-started/...`
  - `/docs/guides/...`
  - `/docs/integrations/...`
  - `/docs/reference/...`
- Add a simple docs entry page at `/docs` that highlights:
  - what the docs cover
  - the main install/start command
  - the key paths into Getting Started, Guides, Integrations, and Reference
- Keep `Vision` inside the docs sidebar as part of onboarding.
- Use the following sidebar model for the first release:
  - Getting Started
  - Guides
  - Integrations
  - Reference
- Shape the initial docs IA as:
  - Getting Started
    - Vision
    - Installation
    - Quickstart
  - Guides
    - First-time setup
    - Create
    - Share
    - Revoke
    - Load
  - Integrations
    - Varlock
  - Reference
    - CLI
    - Varlock plugin
- Treat `better-age` as the main product surface.
- Treat `varlock` as an integration surface with its own dedicated docs and reference pages, but not as a peer top-level product.
- Keep public docs as the editorial source of truth.
- Keep package READMEs concise and secondary:
  - short package summary
  - short usage pointer
  - pointer back to the public site
- Do not auto-generate docs or reference from source code for v1.
- Keep reference curated and hand-authored.
- Split CLI reference into one page per command surface.
- Split varlock reference into one page per public API/integration surface.
- Optimize the first release for the most important user flows first:
  - install
  - setup
  - create
  - share
  - revoke
  - load
  - varlock integration
- Keep the home page intentionally limited:
  - clear product pitch
  - strong CTA into docs
  - enough credibility and positioning
  - not a giant marketing program
- Provide strong search for the docs experience in the first release.
- Keep room for AI-facing affordances such as:
  - `llms.txt`
  - page-level copy/share helpers
  - markdown-friendly consumption
- Treat future versioning as an architectural constraint, not an implementation requirement for the first release.
- Make future versioning easier by:
  - keeping docs routes structured and stable
  - keeping reference pages granular
  - avoiding giant pages that will be painful to diff per version
- Prefer deep modules with clear ownership rather than scattering site behavior across ad hoc layout code.

### Major modules to build or deepen

- **Website Shell**
  - Owns the overall public site shape, top-level navigation, home page shell, docs entry point, and the split between marketing-like and docs-like experiences.
  - Deep module because it hides routing and layout composition behind a small set of stable public surfaces.

- **Docs Content Source**
  - Owns content loading, docs metadata, sidebar registration, ordering, and the connection between authored content and rendered docs pages.
  - Deep module because contributors should add content through one predictable model instead of touching many unrelated site internals.

- **Docs Layout System**
  - Owns the shared docs shell for Getting Started, Guides, Integrations, and Reference, including page chrome, sidebar behavior, pagination, and search integration.
  - Deep module because the docs UX should be centrally controlled and easy to evolve.

- **Home Page Surface**
  - Owns the visual/marketing presentation of the root page and the path into the docs experience.
  - Deep module because the custom home should remain flexible without leaking special-case logic into the docs shell.

- **Reference Publishing Model**
  - Owns the conventions for one-page-per-command and one-page-per-API-surface reference publishing.
  - Deep module because it freezes a durable reference authoring contract instead of letting the section drift into giant pages or generated fragments.

- **Search Integration**
  - Owns client-visible search behavior and indexing assumptions for the static docs site.
  - Deep module because search should feel like one coherent capability, not many page-level hacks.

- **AI/Export Surface**
  - Owns machine-friendly artifacts and copy/share affordances for docs content.
  - Deep module because AI-facing outputs should come from a stable site-level policy rather than per-page improvisation.

- **Versioning Readiness Boundary**
  - Owns the conventions that make later versioning possible without implementing live versions now.
  - Deep module because future doc-version growth should rely on stable content and routing conventions, not on retrofitted migration work.

## Testing Decisions

- Good tests must assert external behavior and durable editorial contracts, not implementation details or private UI structure.
- Good tests for this project should verify:
  - route behavior
  - docs discovery behavior
  - content registration behavior
  - search integration behavior
  - rendering of the agreed IA
  - static-output-safe behavior
  - absence of broken navigation between key pages
- The first testing focus should be on the behavior that makes the site maintainable:
  - docs content registration
  - sidebar structure
  - route stability
  - reference-page conventions
  - search availability
  - AI/export artifact presence where implemented
- Modules/behaviors that should be tested:
  - home page renders the product pitch and docs CTA
  - `/docs` entry page exposes key sections and important quick actions
  - sidebar renders the agreed section model in the right order
  - Getting Started pages are discoverable and linked correctly
  - Guides pages are discoverable and linked correctly
  - Integrations includes varlock in the expected place
  - Reference pages resolve one page per CLI command and one page per varlock API surface
  - search indexes and surfaces docs content correctly on the static site
  - static deployment output preserves the expected docs behavior
  - AI/export surfaces such as `llms.txt` or page-copy helpers behave as intended if included in the first slice
- Good tests for the content system should validate visible outcomes:
  - a page registered in content appears in the correct docs navigation position
  - a page removed from content disappears cleanly from navigation
  - a broken content registration fails loudly
- Good tests for docs UX should verify user-visible results:
  - users can move from home to docs
  - users can move from docs index to onboarding/guides/reference
  - users can find command/API surfaces through navigation and search
- Prior art in the codebase:
  - package tests already favor black-box behavior over implementation detail
  - CLI and plugin work already emphasize visible contract testing, which should carry over to the website project
- Expected test layers:
  - content/config tests for docs registration and sidebar structure
  - route/render tests for key pages and shared layout behavior
  - static-output smoke tests for the built site shape
  - UX-level tests for main navigation flows

## Out of Scope

- live docs versioning in the first release
- branch-per-version, subdomain-per-version, or version switcher implementation
- auto-generated CLI or plugin docs from source code
- turning package READMEs into the full public docs source
- multiple separate website apps for marketing and docs
- a broad CMS or non-repo editorial backend
- authentication or gated docs
- comments, ratings, or community discussion features
- localization/i18n in the first release
- a large marketing site beyond the intentionally small home page
- a blog/news/release-notes system unless added later as a separate decision
- analytics or growth tooling beyond what is needed to ship the site
- redesigning the product itself while writing the docs
- committing to competitor comparison matrices beyond the positioning needed in Vision and public copy

## Further Notes

- This PRD intentionally treats the docs website as a product surface, not as an afterthought around markdown rendering.
- The site should teach one narrow, opinionated workflow that matches the product stance of `better-age`.
- The first release should favor coherence over completeness. A smaller but clearly structured docs site is better than a sprawling site with weak IA.
- The home page should support commercial credibility, but the center of gravity remains the docs experience.
- The most important architectural choice for maintainability is central authorship: one standalone website app, one docs tree, one coherent sidebar model.
- Future versioning is expected, but implementing it too early would distract from the more important problem: shipping a clear, durable public docs experience first.
