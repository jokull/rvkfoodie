import type { Metadata, Viewport } from "next";
import "./globals.css";
import { EditorTokenScript } from "@/app/_components/editor-token-script";

export const metadata: Metadata = {
  title: {
    default: "Reykjavík Foodie — Local Food & Restaurant Guides",
    template: "%s — Reykjavík Foodie",
  },
  description:
    "Honest food guides for Reykjavík — written by a local, updated regularly.",
  metadataBase: new URL("https://www.rvkfoodie.is"),
  openGraph: {
    siteName: "Reykjavík Foodie",
    locale: "en_US",
    type: "website",
    images: [{ url: "/og-default.jpg", width: 1200, height: 630 }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <EditorTokenScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          defer
          src="https://assets.onedollarstats.com/stonks.js"
        />
      </head>
      <body className="bg-cream text-ink font-body text-normal leading-normal antialiased">
        <header className="max-w-2xl mx-auto px-6 pt-8 sm:pt-12 pb-6 sm:pb-8">
          <nav className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
            <a href="/" className="inline-block">
              <img
                src="/logo.svg"
                alt="Reykjavík Foodie"
                className="h-16 sm:h-30"
              />
            </a>
            <div className="flex items-center gap-4 sm:gap-6 text-tiny">
              <a
                href="/search"
                className="text-ink-light hover:text-blue transition-colors"
                aria-label="Search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </a>
              <a
                href="/about"
                className="text-ink-light hover:text-blue transition-colors"
              >
                About
              </a>
              <a
                href="/changelog"
                className="text-ink-light hover:text-blue transition-colors"
              >
                Updates
              </a>
              <a
                href="https://instagram.com/rvkfoodie"
                target="_blank"
                rel="noopener"
                className="text-ink-light hover:text-blue transition-colors"
              >
                Instagram
              </a>
            </div>
          </nav>
        </header>
        <main className="max-w-2xl mx-auto px-6 pb-24">{children}</main>
        <footer className="max-w-2xl mx-auto px-6 pb-12 text-tiny text-ink-light leading-tiny">
          <div className="border-t border-ink/10 pt-8 space-y-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <a
                href="/guides/food-guide"
                className="hover:text-blue transition-colors"
              >
                Food Guide
              </a>
              <a
                href="/guides/bar-crawl"
                className="hover:text-blue transition-colors"
              >
                Bar Crawl
              </a>
              <a
                href="/guides/golden-circle"
                className="hover:text-blue transition-colors"
              >
                Golden Circle
              </a>
              <a
                href="/changelog"
                className="hover:text-blue transition-colors"
              >
                Guide Updates
              </a>
              <a
                href="/about"
                className="hover:text-blue transition-colors"
              >
                About
              </a>
            </div>
            <div className="flex items-center justify-between">
              <span>&copy; {new Date().getFullYear()} Reykjavík Foodie</span>
              <a
                href="https://instagram.com/rvkfoodie"
                target="_blank"
                rel="noopener"
                className="hover:text-blue transition-colors"
              >
                @rvkfoodie
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
