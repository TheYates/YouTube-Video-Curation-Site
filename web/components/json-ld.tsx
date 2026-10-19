import { safeJson } from "../lib/schema";

// The single place JSON-LD markup is emitted. Every public page renders exactly
// one of these, and the @graph it carries is composed by pageJsonLd() in
// lib/schema.ts (site entities + the page's own nodes). Keeping emission to one
// tag per page is what the "one source" rule buys: no page can accidentally
// declare the same entity twice.
export default function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJson(data) }}
    />
  );
}
