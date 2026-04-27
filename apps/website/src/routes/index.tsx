import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { useState } from "react";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/")({
  component: Home,
});

const terminalLines = [
  { text: "$ npm install -g @better-age/cli", tone: "muted" },
  { text: "$ bage setup --name Alice", tone: "muted" },
  { text: "[OK] Identity created", tone: "ok" },
  { text: "$ bage create .env.enc", tone: "muted" },
  { text: "$ bage edit .env.enc", tone: "muted" },
  { text: "[OK] Payload encrypted for Alice", tone: "ok" },
  { text: "$ bage identity import 'better-age://...'", tone: "muted" },
  { text: "[OK] Bob saved as known identity", tone: "ok" },
  { text: "$ bage grant .env.enc bob", tone: "muted" },
  { text: "[OK] Bob can decrypt future copies", tone: "accent" },
  { text: "$ varlock run -- pnpm dev", tone: "muted" },
  { text: "passphrase: ********", tone: "soft" },
  { text: "[OK] env loaded locally", tone: "ok" },
] as const;

const workflows = [
  {
    label: "Create",
    command: "bage create .env.enc",
    text: "Start with one encrypted env payload, owned by your repo instead of a dashboard.",
  },
  {
    label: "Edit",
    command: "bage edit .env.enc",
    text: "Open plaintext only while editing. The file that remains is ciphertext.",
  },
  {
    label: "Run",
    command: "varlock run -- pnpm dev",
    text: "Let Varlock ask better-age for env text at process start.",
  },
  {
    label: "Share",
    command: "bage grant .env.enc bob",
    text: "Add teammates by public identity. Send ciphertext through the channels you already use.",
  },
] as const;

const aliceShareLines = [
  { text: "# Ask Bob for his public identity", tone: "wait" },
  { text: "$ bage identity import 'better-age://...'", tone: "muted" },
  { text: "[OK] imported Bob as bob", tone: "ok" },
  { text: "$ bage grant .env.enc bob", tone: "muted" },
  { text: "# Share updated .env.enc with Bob", tone: "wait" },
  { text: "[OK] .env.enc encrypted for Bob", tone: "accent" },
] as const;

const bobShareLines = [
  { text: "$ bage setup --name Bob", tone: "muted" },
  { text: "$ bage identity export", tone: "muted" },
  { text: "# Share identity string with Alice", tone: "wait" },
  { text: "better-age://identity/v1/...", tone: "soft" },
  { text: "# Receive updated .env.enc", tone: "wait" },
  { text: "$ varlock run -- pnpm dev", tone: "muted" },
  { text: "[OK] env loaded locally", tone: "ok" },
] as const;

const sharingSteps = [
  {
    label: "1",
    title: "Bob sends identity",
    text: "Bob exports a public identity string and sends it to Alice through chat, email, or any normal team channel.",
  },
  {
    label: "2",
    title: "Alice grants payload",
    text: "Alice imports Bob, grants `.env.enc`, and sends the updated encrypted file back.",
  },
  {
    label: "3",
    title: "Bob runs locally",
    text: "Bob unlocks with his own passphrase. No shared team passphrase is needed.",
  },
] as const;

function Home() {
  const [installCopied, setInstallCopied] = useState(false);

  const copyInstallCommand = async () => {
    await navigator.clipboard.writeText("npm install -g @better-age/cli");
    setInstallCopied(true);
    window.setTimeout(() => setInstallCopied(false), 1600);
  };

  return (
    <HomeLayout {...baseOptions()}>
      <main className="w-full overflow-hidden">
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl content-center gap-12 px-4 py-12 md:grid-cols-[minmax(0,0.95fr)_minmax(0,0.8fr)] md:px-8 md:py-20">
          <div className="min-w-0 max-w-4xl self-center">
            <p className="mb-7 font-mono text-xs uppercase tracking-[0.18em] text-fd-muted-foreground">
              local-first secrets for small teams
            </p>
            <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[0.96] tracking-normal md:text-7xl lg:text-8xl">
              Share .env files without sharing plaintext.
            </h1>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-fd-muted-foreground md:text-xl">
              <strong className="font-semibold text-fd-foreground">
                better-age
              </strong>{" "}
              keeps the workflow close to the thing teams already do: one env
              file, one teammate, one local command. The difference is that the
              file you pass around is age-encrypted ciphertext.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a
                href="/docs/quickstart"
                className="inline-flex min-w-0 items-center justify-center border border-fd-foreground bg-fd-foreground px-4 py-3 text-center font-mono text-sm font-medium text-fd-background transition hover:-translate-y-0.5"
              >
                read quickstart
              </a>
              <button
                aria-label="Copy install command"
                className="relative inline-flex min-w-0 cursor-copy items-center justify-center border border-fd-border px-4 py-3 text-center font-mono text-sm font-medium transition hover:-translate-y-0.5 hover:border-fd-foreground"
                onClick={copyInstallCommand}
                type="button"
              >
                <span
                  className={`transition-opacity ${
                    installCopied ? "opacity-0" : "opacity-100"
                  }`}
                >
                  npm install -g @better-age/cli
                </span>
                <span
                  className={`absolute inset-0 flex items-center justify-center px-4 py-3 transition-opacity ${
                    installCopied ? "opacity-100" : "opacity-0"
                  }`}
                >
                  copied
                </span>
              </button>
            </div>
          </div>

          <div className="relative min-w-0 self-center border-l border-fd-border pl-5 md:pl-8">
            <div className="mb-5 flex items-center justify-between gap-4 font-mono text-xs text-fd-muted-foreground">
              <span>terminal</span>
            </div>
            <pre className="home-terminal whitespace-pre-wrap break-words pb-3 font-mono text-sm leading-7 md:text-[15px]">
              <code>
                {terminalLines.map((line, index) => (
                  <span
                    className={`home-terminal-line home-terminal-${line.tone}`}
                    key={line.text}
                    style={{ animationDelay: `${index * 220}ms` }}
                  >
                    {line.text}
                    {"\n"}
                  </span>
                ))}
              </code>
            </pre>
            <p className="mt-5 max-w-md text-sm leading-6 text-fd-muted-foreground">
              No hosted vault. No copied plaintext in chat. No new runtime
              abstraction if Varlock already fits your app.
            </p>
          </div>
        </section>

        <section className="border-y border-fd-border bg-fd-muted/20">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-[0.7fr_1fr] md:px-8 md:py-16">
            <h2 className="max-w-lg text-3xl font-semibold tracking-normal md:text-5xl">
              Secrets stay local. Ciphertext travels.
            </h2>
            <div className="grid gap-6 text-sm leading-7 text-fd-muted-foreground md:grid-cols-2">
              <p>
                Git becomes a reasonable place for the encrypted payload. age
                handles the encryption model.{" "}
                <strong className="font-semibold text-fd-foreground">
                  better-age
                </strong>{" "}
                handles the workflow around setup, editing, recipients,
                rotation, and loading.
              </p>
              <p>
                The target is not enterprise secret governance. It is the
                earlier phase where you want something much better than
                plaintext `.env` sharing without introducing a cloud manager.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20">
          <div className="grid gap-10 md:grid-cols-[0.34fr_1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-fd-muted-foreground">
                workflow
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-normal">
                Four commands, not a platform migration.
              </h2>
            </div>
            <div className="divide-y divide-fd-border border-y border-fd-border">
              {workflows.map((item) => (
                <div
                  className="grid gap-4 py-6 md:grid-cols-[8rem_minmax(0,0.9fr)_minmax(0,1fr)] md:items-baseline"
                  key={item.label}
                >
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-fd-muted-foreground">
                    {item.label}
                  </p>
                  <code className="font-mono text-sm text-fd-foreground">
                    {item.command}
                  </code>
                  <p className="text-sm leading-6 text-fd-muted-foreground">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-fd-border bg-fd-muted/20">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-8 md:py-20">
            <div>
              <h2 className="text-3xl font-semibold tracking-normal">
                Share securely
              </h2>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_10rem_1fr] lg:items-center">
              <div>
                <div className="mb-3 flex items-center justify-between font-mono text-xs text-fd-muted-foreground">
                  <span>Alice (owner)</span>
                </div>
                <pre className="home-terminal home-terminal-dark home-terminal-compact min-h-52 whitespace-pre-wrap break-words px-4 py-4 font-mono text-sm leading-7 shadow-sm">
                  <code>
                    {aliceShareLines.map((line, index) => (
                      <span
                        className={`home-terminal-line home-terminal-${line.tone}`}
                        key={line.text}
                        style={{ animationDelay: `${700 + index * 220}ms` }}
                      >
                        {line.text}
                        {"\n"}
                      </span>
                    ))}
                  </code>
                </pre>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_1.25rem_1.25rem_minmax(0,1fr)] items-center gap-3 self-center font-mono text-xs lg:hidden">
                <span className="home-share-label-mobile justify-self-end text-right">
                  identity string
                </span>
                <div className="home-share-arrow-mobile home-share-arrow-mobile-up" />
                <div className="home-share-arrow-mobile home-share-arrow-mobile-down" />
                <span className="home-share-label-mobile justify-self-start">
                  .env.enc
                </span>
              </div>

              <div className="hidden self-center font-mono text-xs lg:grid lg:gap-5 lg:px-1">
                <div className="home-share-arrow-desktop home-share-arrow-desktop-left">
                  <span>identity string</span>
                </div>
                <div className="home-share-arrow-desktop home-share-arrow-desktop-right">
                  <span>.env.enc</span>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between font-mono text-xs text-fd-muted-foreground">
                  <span>Bob (receiver)</span>
                </div>
                <pre className="home-terminal home-terminal-dark home-terminal-compact min-h-52 whitespace-pre-wrap break-words px-4 py-4 font-mono text-sm leading-7 shadow-sm">
                  <code>
                    {bobShareLines.map((line, index) => (
                      <span
                        className={`home-terminal-line home-terminal-${line.tone}`}
                        key={line.text}
                        style={{ animationDelay: `${index * 220}ms` }}
                      >
                        {line.text}
                        {"\n"}
                      </span>
                    ))}
                  </code>
                </pre>
              </div>
            </div>

            <div className="grid gap-0 divide-y divide-fd-border border-y border-fd-border md:grid-cols-3 md:divide-x md:divide-y-0">
              {sharingSteps.map((step) => (
                <div className="py-5 md:px-6" key={step.label}>
                  <p className="font-mono text-xs text-fd-muted-foreground">
                    step {step.label}
                  </p>
                  <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[1fr_0.9fr] md:px-8 md:py-24">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-fd-muted-foreground">
              built around age
            </p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-normal md:text-5xl">
              Simple by choice. Transparent by design.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-fd-muted-foreground">
              The crypto story belongs to age.{" "}
              <strong className="font-semibold text-fd-foreground">
                better-age
              </strong>{" "}
              adds local identity state, encrypted env payloads, passphrase
              prompts, key rotation, grants, revokes, and a Varlock provider
              path that feels native in local development.
            </p>
          </div>

          <nav aria-label="Recommended documentation">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-fd-muted-foreground">
              next reads
            </p>
            <div className="mt-5 divide-y divide-fd-border border-y border-fd-border">
              <a
                className="group flex items-center justify-between gap-4 py-4 text-sm"
                href="/docs/why"
              >
                <span>Why better-age?</span>
                <span className="font-mono text-fd-muted-foreground transition group-hover:translate-x-1">
                  -&gt;
                </span>
              </a>
              <a
                className="group flex items-center justify-between gap-4 py-4 text-sm"
                href="/docs/guides/varlock-runtime"
              >
                <span>Use it through Varlock</span>
                <span className="font-mono text-fd-muted-foreground transition group-hover:translate-x-1">
                  -&gt;
                </span>
              </a>
              <a
                className="group flex items-center justify-between gap-4 py-4 text-sm"
                href="/docs/trust"
              >
                <span>Trust and limitations</span>
                <span className="font-mono text-fd-muted-foreground transition group-hover:translate-x-1">
                  -&gt;
                </span>
              </a>
            </div>
          </nav>
        </section>

        <footer className="bg-black text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 text-sm md:flex-row md:items-center md:justify-between md:px-8">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs">
              <a className="hover:underline" href="https://paulsenon.com">
                © {new Date().getFullYear()} Paul Senon
              </a>
              <span className="text-white/35">/</span>
              <a className="hover:underline" href="https://paulsenon.com">
                paulsenon.com
              </a>
              <span className="text-white/35">/</span>
              <span className="inline-flex items-center gap-2 text-white/70">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                open to work
              </span>
            </div>
            <nav
              aria-label="Footer"
              className="flex flex-wrap gap-x-5 gap-y-3 font-mono text-xs [&_a:hover]:underline"
            >
              <a href="/docs">Docs</a>
              <a href="https://github.com/PaulSenon/better-age">GitHub</a>
              <a href="https://github.com/PaulSenon/better-age/issues/new/choose">
                Open an issue
              </a>
              <a href="https://x.com/isaaacdotdev">X / @isaaacdotdev</a>
            </nav>
          </div>
        </footer>
      </main>
    </HomeLayout>
  );
}
