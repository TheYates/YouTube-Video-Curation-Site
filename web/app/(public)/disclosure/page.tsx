import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Disclosure",
  description: "How Signal handles affiliate links and advertising, in plain language.",
};

export default function DisclosurePage() {
  return (
    <main className="page-enter mx-auto max-w-2xl px-6 py-12">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-(--color-accent)">
        Disclosure
      </p>
      <h1 className="font-display text-4xl leading-tight text-(--color-foreground) sm:text-5xl">
        How the lights stay on.
      </h1>

      <div className="mt-8 space-y-5 text-base leading-relaxed text-(--color-foreground)">
        <section className="space-y-2">
          <h2 className="font-display text-xl">Affiliate links</h2>
          <p>
            Some articles include resource links (books, tools, courses) marked with
            labels like “Affiliate link.” If you buy through one, the retailer may
            pay Signal a small commission — at no extra cost to you.
          </p>
          <p>
            Commissions never decide what gets curated. A video earns its page by
            being worth your time; the links underneath are follow-up material the
            curator would recommend anyway.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Advertising</h2>
          <p>
            Signal currently runs no ads and no sponsored placements. If that
            changes, sponsored content will be labeled as such, on this page and
            next to the content itself — never disguised as curation.
          </p>
        </section>

        <p className="text-(--color-muted-foreground)">
          Questions about any of this?{" "}
          <Link href="/contact" className="text-(--color-accent) hover:underline">
            Ask directly
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
