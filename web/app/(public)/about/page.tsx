import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "Who runs Signal, how every video is curated, and why this library exists.",
};

export default function AboutPage() {
  return (
    <main className="page-enter mx-auto max-w-2xl px-6 py-12">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-(--color-accent)">
        About
      </p>
      <h1 className="font-display text-4xl leading-tight text-(--color-foreground) sm:text-5xl">
        A human reads the internet so you don’t have to.
      </h1>

      <div className="mt-8 space-y-5 text-base leading-relaxed text-(--color-foreground)">
        <p>
          Signal is run by [YOUR NAME], [YOUR STORY — one or two sentences: who you
          are, what you do, why you started pulling the best ideas out of long
          videos]. Find me as [YOUR HANDLE] — that’s the fastest way to reach a
          person, not a form.
        </p>
        <p>
          Every video here is hand-picked, not scraped. The bar is simple: would I
          send this to a smart friend? If yes, it goes through the full treatment —
          a complete human-readable transcript you can click to jump to the exact
          moment, an AI-assisted summary and takeaways, chapter markers, and still
          frames pulled from the video itself.
        </p>
        <p>
          Nothing here is auto-generated filler. Curation is the product: a small,
          opinionated library across finance, tech, science, philosophy, and
          whatever earns its place next — timeless ideas over trending noise.
        </p>
        <p className="text-(--color-muted-foreground)">
          Questions, corrections, or a video you think belongs here?{" "}
          <Link href="/contact" className="text-(--color-accent) hover:underline">
            Get in touch
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
