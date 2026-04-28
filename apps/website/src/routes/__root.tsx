import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import SearchDialog from "@/components/search";
import { appName, siteDescription, siteUrl } from "@/lib/shared";
import appCss from "@/styles/app.css?url";

const ogImageUrl = `${siteUrl}/og.e509b0a6dd75.jpg`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: `${appName} docs`,
      },
      {
        name: "description",
        content: siteDescription,
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:site_name",
        content: appName,
      },
      {
        property: "og:title",
        content: appName,
      },
      {
        property: "og:description",
        content: "Share .env files without sharing plaintext.",
      },
      {
        property: "og:url",
        content: siteUrl,
      },
      {
        property: "og:image",
        content: ogImageUrl,
      },
      {
        property: "og:image:width",
        content: "1200",
      },
      {
        property: "og:image:height",
        content: "630",
      },
      {
        property: "og:image:alt",
        content: "better-age: Share .env files without sharing plaintext.",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: appName,
      },
      {
        name: "twitter:description",
        content: "Share .env files without sharing plaintext.",
      },
      {
        name: "twitter:image",
        content: ogImageUrl,
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      {
        rel: "icon",
        href: "/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider search={{ SearchDialog }}>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
