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
              Local-first secret provider for Varlock
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
                Share .env files like before, just encrypted.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-fd-muted-foreground md:text-lg">
                <strong className="font-semibold text-fd-foreground">
                  better-age
                </strong>{" "}
                gives small teams one visible encrypted payload, age-backed
                encryption, explicit identity grants, and a Varlock runtime path
                that still feels close to normal local dev.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/docs/quickstart"
                className="rounded-xl bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground"
              >
                Quickstart
              </a>
              <a
                href="/docs/why"
                className="rounded-xl border border-fd-border px-4 py-2.5 text-sm font-medium"
              >
                Why <strong>better-age</strong>?
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-fd-border bg-fd-background p-5">
            <p className="text-sm font-medium text-fd-foreground">Happy path</p>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-fd-secondary px-4 py-4 text-sm leading-7">
              <code>{`npm install -g @better-age/cli
bage setup --name Alice
bage create .env.enc
bage edit .env.enc

# .env.schema
# @plugin(@better-age/varlock)
# @initBetterAge(path=.env.enc)
# @setValuesBulk(betterAgeLoad(), format=env)`}</code>
            </pre>
            <p className="mt-4 text-sm leading-6 text-fd-muted-foreground">
              Start local. Add Varlock. Share with teammates only when the file
              workflow is clear.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-fd-border bg-fd-card p-5">
            <h2 className="text-lg font-semibold">Narrow by design</h2>
            <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
              <strong className="font-semibold text-fd-foreground">
                better-age
              </strong>{" "}
              is not a generic secret manager. It stays focused on encrypted
              .env payloads, explicit recipients, and strong defaults.
            </p>
          </article>
          <article className="rounded-2xl border border-fd-border bg-fd-card p-5">
            <h2 className="text-lg font-semibold">Built on age</h2>
            <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
              age is the crypto primitive.{" "}
              <strong className="font-semibold text-fd-foreground">
                better-age
              </strong>{" "}
              uses Typage and focuses on setup, identity sharing, access
              updates, and day-to-day env handling.
            </p>
          </article>
          <article className="rounded-2xl border border-fd-border bg-fd-card p-5">
            <h2 className="text-lg font-semibold">Varlock first</h2>
            <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
              The plugin stays thin and shells out to
              <code className="mx-1 rounded bg-fd-secondary px-1.5 py-0.5 text-xs">
                bage load --protocol-version=1
              </code>
              so runtime loading remains explicit.
            </p>
          </article>
        </section>

        <section className="grid gap-4 rounded-3xl border border-fd-border bg-fd-card/40 p-6 md:grid-cols-4">
          <div>
            <p className="text-sm font-medium text-fd-muted-foreground">
              1. Set up once
            </p>
            <p className="mt-2 text-sm leading-6">
              Create your local identity and protect the private key with a
              passphrase.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-fd-muted-foreground">
              2. Edit encrypted
            </p>
            <p className="mt-2 text-sm leading-6">
              Work with env text in your editor, then keep only the encrypted
              payload around.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-fd-muted-foreground">
              3. Run with Varlock
            </p>
            <p className="mt-2 text-sm leading-6">
              Let Varlock ask{" "}
              <strong className="font-semibold">better-age</strong> for env text
              when your local process starts.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-fd-muted-foreground">
              4. Share explicitly
            </p>
            <p className="mt-2 text-sm leading-6">
              Import a teammate identity, grant the payload, then send the
              encrypted file.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-2xl border border-fd-border bg-fd-card p-6">
            <h2 className="text-2xl font-semibold">
              A better default before enterprise secrets
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-fd-muted-foreground">
              <strong className="font-semibold text-fd-foreground">
                better-age
              </strong>{" "}
              is for the phase where a team is still small, still moving fast,
              and would otherwise share plaintext .env files. It is not a cloud
              manager, KMS policy engine, or CI secret store.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="/docs/trust"
                className="rounded-xl border border-fd-border px-4 py-2 text-sm font-medium"
              >
                Trust
              </a>
              <a
                href="/docs/limitations"
                className="rounded-xl border border-fd-border px-4 py-2 text-sm font-medium"
              >
                Limitations
              </a>
            </div>
          </article>

          <article className="rounded-2xl border border-fd-border bg-fd-card p-6">
            <h2 className="text-lg font-semibold">Best next pages</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6">
              <li>
                <a
                  className="font-medium underline underline-offset-4"
                  href="/docs/install"
                >
                  Install
                </a>
                <div className="text-fd-muted-foreground">
                  global CLI first, npx alternative, Varlock plugin install
                </div>
              </li>
              <li>
                <a
                  className="font-medium underline underline-offset-4"
                  href="/docs/guides/varlock-runtime"
                >
                  Varlock runtime
                </a>
                <div className="text-fd-muted-foreground">
                  use <strong className="font-semibold">better-age</strong> as
                  the encrypted local provider
                </div>
              </li>
              <li>
                <a
                  className="font-medium underline underline-offset-4"
                  href="/docs/reference/cli"
                >
                  CLI reference
                </a>
                <div className="text-fd-muted-foreground">
                  exact commands, stdout policy, and examples
                </div>
              </li>
            </ul>
          </article>
        </section>
      </main>
    </HomeLayout>
  );
}
