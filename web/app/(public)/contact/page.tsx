import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the human behind Signal.",
};

const EMAIL = "hhh.3nree@gmail.com";

export default function ContactPage() {
  return (
    <main className="page-enter mx-auto max-w-2xl px-6 py-12">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-(--color-accent)">
        Contact
      </p>
      <h1 className="font-display text-4xl leading-tight text-(--color-foreground) sm:text-5xl">
        Talk to a person.
      </h1>

      <div className="mt-8 space-y-5 text-base leading-relaxed text-(--color-foreground)">
        <p>
          Corrections, video suggestions, partnership ideas, or just saying hi —
          it all lands in the same inbox, and a human reads everything.
        </p>
        <p>
          <a
            href={`mailto:${EMAIL}`}
            className="font-mono text-sm text-(--color-accent) hover:underline"
          >
            {EMAIL}
          </a>
        </p>
        <p className="text-(--color-muted-foreground)">
          I usually reply within a couple of days. If your message is about a
          specific video, include its title or link so I can find it fast.
        </p>
      </div>
    </main>
  );
}
