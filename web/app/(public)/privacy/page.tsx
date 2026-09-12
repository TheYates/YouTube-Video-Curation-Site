import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What data Signal collects, what YouTube embeds collect, and your choices.",
};

export default function PrivacyPage() {
  return (
    <main className="page-enter mx-auto max-w-2xl px-6 py-12">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-(--color-accent)">
        Privacy Policy
      </p>
      <h1 className="font-display text-4xl leading-tight text-(--color-foreground) sm:text-5xl">
        Your business is your business.
      </h1>
      <p className="mt-3 font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        Last updated: September 2026
      </p>

      <div className="mt-8 space-y-5 text-base leading-relaxed text-(--color-foreground)">
        <section className="space-y-2">
          <h2 className="font-display text-xl">What we collect</h2>
          <p>
            Almost nothing. Signal keeps anonymous, aggregate page-view counts so the
            curator can see which videos get read. These contain no names, no emails,
            no accounts, and nothing that identifies you personally.
          </p>
          <p>
            There are no user accounts on Signal, and the newsletter signup is
            currently disabled — so we hold no email addresses and no subscriber
            list. If that ever changes, this page will say so first.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">YouTube embeds</h2>
          <p>
            Every article embeds a YouTube player. When you load or play a video,
            YouTube (Google) may set its own cookies and collect viewing data under{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--color-accent) hover:underline"
            >
              Google’s Privacy Policy
            </a>{" "}
            — that traffic never touches Signal’s servers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Advertising</h2>
          <p>
            Signal currently shows no ads and sets no advertising cookies. If
            advertising (such as Google AdSense) is added in the future, ad vendors
            may use cookies to serve relevant ads, and this policy will be updated
            to name them before they go live.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Questions &amp; removal</h2>
          <p>
            Want to know what (little) data relates to you, or want it deleted?{" "}
            <Link href="/contact" className="text-(--color-accent) hover:underline">
              Contact us
            </Link>{" "}
            and we’ll sort it out.
          </p>
        </section>
      </div>
    </main>
  );
}
