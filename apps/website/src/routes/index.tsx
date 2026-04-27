import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 md:px-6 md:py-16">
        <section className="grid gap-8 rounded-3xl border border-fd-border bg-fd-card/60 p-6 md:grid-cols-[1.4fr_0.9fr] md:p-10">
          <div className="space-y-5">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-fd-muted-foreground">
              Local-first encrypted .env workflow
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
                Encrypted env files with fewer decisions.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-fd-muted-foreground md:text-lg">
                better-age is the narrow UX layer on top of age for teams that
                want one visible encrypted payload, one local identity setup,
                explicit grant and revoke, and a clean split between human view
                and machine load.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/docs"
                className="rounded-xl bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground"
              >
                Read the docs
              </a>
              <a
                href="/docs/getting-started/quickstart"
                className="rounded-xl border border-fd-border px-4 py-2.5 text-sm font-medium"
              >
                Quickstart
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-fd-border bg-fd-background p-5">
            <p className="text-sm font-medium text-fd-foreground">Happy path</p>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-fd-secondary px-4 py-4 text-sm leading-7">
              <code>{`npx @better-age/cli setup
bage create .env.prod.enc
bage edit .env.prod.enc
bage grant .env.prod.enc teammate#0123abcd
bage view .env.prod.enc
bage load --protocol-version=1 .env.prod.enc`}</code>
            </pre>
            <p className="mt-4 text-sm leading-6 text-fd-muted-foreground">
              Start with one command. Keep the payload file caller-owned. Use
              view for humans and load for machines.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-fd-border bg-fd-card p-5">
            <h2 className="text-lg font-semibold">Narrow by design</h2>
            <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
              better-age is not a generic secret manager. It stays focused on
              encrypted .env payloads, explicit recipients, and strong defaults.
            </p>
          </article>
          <article className="rounded-2xl border border-fd-border bg-fd-card p-5">
            <h2 className="text-lg font-semibold">Built on age</h2>
            <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
              age is the crypto primitive. better-age is the UX layer that cuts
              ceremony around setup, identity sharing, access updates, and day
              to day secret handling.
            </p>
          </article>
          <article className="rounded-2xl border border-fd-border bg-fd-card p-5">
            <h2 className="text-lg font-semibold">Varlock ready</h2>
            <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
              The varlock plugin stays thin and shells out to
              <code className="mx-1 rounded bg-fd-secondary px-1.5 py-0.5 text-xs">
                bage load --protocol-version=1
              </code>
              so machine loading remains explicit.
            </p>
          </article>
        </section>

        <section className="grid gap-4 rounded-3xl border border-fd-border bg-fd-card/40 p-6 md:grid-cols-4">
          <div>
            <p className="text-sm font-medium text-fd-muted-foreground">
              1. Setup once
            </p>
            <p className="mt-2 text-sm leading-6">
              Create your local identity and protect the private key with a
              passphrase.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-fd-muted-foreground">
              2. Share identity
            </p>
            <p className="mt-2 text-sm leading-6">
              Send your identity string once. Others can add it as a known
              identity without touching payloads yet.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-fd-muted-foreground">
              3. Grant explicitly
            </p>
            <p className="mt-2 text-sm leading-6">
              Grant or revoke recipients directly on the encrypted payload.
              Access stays visible and caller-owned.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-fd-muted-foreground">
              4. Read the right way
            </p>
            <p className="mt-2 text-sm leading-6">
              Use view for humans in the secure viewer. Use load for machines
              through the versioned load protocol.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-2xl border border-fd-border bg-fd-card p-6">
            <h2 className="text-2xl font-semibold">
              Start in docs, not in scattered READMEs
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-fd-muted-foreground">
              The public site is the editorial source of truth: product stance,
              onboarding, guides, varlock integration, and reference live in one
              coherent docs shell under /docs.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="/docs/getting-started/vision"
                className="rounded-xl border border-fd-border px-4 py-2 text-sm font-medium"
              >
                Read the vision
              </a>
              <a
                href="/docs/integrations/varlock"
                className="rounded-xl border border-fd-border px-4 py-2 text-sm font-medium"
              >
                Varlock integration
              </a>
            </div>
          </article>

          <article className="rounded-2xl border border-fd-border bg-fd-card p-6">
            <h2 className="text-lg font-semibold">Best next pages</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6">
              <li>
                <a
                  className="font-medium underline underline-offset-4"
                  href="/docs/getting-started/installation"
                >
                  Installation
                </a>
                <div className="text-fd-muted-foreground">
                  no global install assumption, just get to first setup fast
                </div>
              </li>
              <li>
                <a
                  className="font-medium underline underline-offset-4"
                  href="/docs/getting-started/quickstart"
                >
                  Quickstart
                </a>
                <div className="text-fd-muted-foreground">
                  create, edit, grant, view, load
                </div>
              </li>
              <li>
                <a
                  className="font-medium underline underline-offset-4"
                  href="/docs/reference/cli-command-groups"
                >
                  CLI command groups
                </a>
                <div className="text-fd-muted-foreground">
                  exact command map before the deeper reference lands
                </div>
              </li>
            </ul>
          </article>
        </section>
      </main>
    </HomeLayout>
  );
}
