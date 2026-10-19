import type { Video } from "./types";
import { categorySlug } from "./category";
import { truncateWords } from "./text";
import { siteUrl } from "./site-url";

// Structured data lives in one place. Every page emits exactly ONE
// <script type="application/ld+json"> containing a single @graph, composed by
// pageJsonLd(): the site-wide entities (Organization/WebSite/Person) plus the
// page's own nodes. Cross-references between them still resolve by @id inside
// that one graph — that is what ties every VideoObject to one publisher entity.
export const SITE_NAME = "Curataur";

export function organizationId(base = siteUrl()): string {
  return `${base}/#organization`;
}

export function websiteId(base = siteUrl()): string {
  return `${base}/#website`;
}

// The curator — the person who runs the site and writes each page. Distinct
// from the source channel, which is the *video's* author. One @id so the
// site-wide graph and every per-video WebPage node point at the same entity.
export function personId(base = siteUrl()): string {
  return `${base}/#person`;
}

export const CURATOR = {
  name: "Henri",
  url: "https://www.facebook.com/henrithelayup",
};

// JSON for embedding inside <script>. JSON.stringify leaves "<" and the JS
// line separators intact, so a title containing "</script>" could close the
// tag early. Escaping them keeps the payload inert.
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function siteNodes(base = siteUrl()) {
  return [
    {
      "@type": "Organization",
      "@id": organizationId(base),
      name: SITE_NAME,
      url: base,
      logo: {
        "@type": "ImageObject",
        url: `${base}/logo.svg`,
        width: 512,
        height: 512,
      },
    },
    {
      "@type": "WebSite",
      "@id": websiteId(base),
      name: SITE_NAME,
      url: base,
      publisher: { "@id": organizationId(base) },
      potentialAction: {
        "@type": "SearchAction",
        target: `${base}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      // Declaring the curator once per page is what lets every video page name a
      // real author (E-E-A-T) without the reader having to infer it.
      "@type": "Person",
      "@id": personId(base),
      name: CURATOR.name,
      url: CURATOR.url,
      sameAs: [CURATOR.url],
      worksFor: { "@id": organizationId(base) },
    },
  ];
}

// Compose the single @graph a page emits: the site-wide entities plus whatever
// page-specific nodes it passes. This is the ONLY place JSON-LD is assembled, so
// each page renders exactly one <script> (via components/json-ld.tsx).
export function pageJsonLd(pageNodes: object[], base = siteUrl()) {
  return {
    "@context": "https://schema.org",
    "@graph": [...siteNodes(base), ...pageNodes],
  };
}

// ISO 8601 duration without zero-valued units ("PT11M4S", not "PT0H11M4S").
function isoDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}

export function videoNodes(video: Video, base = siteUrl()): object[] {
  const pageUrl = `${base}/video/${video.slug}`;
  const description = truncateWords(video.summary || video.title, 500);

  // Chapters are already stored in chronological order, but sort defensively:
  // Clip.startOffset must ascend for the "Key moments" rich result.
  const chapters = [...video.chapters]
    .filter((c) => Number.isFinite(c.startTime) && c.startTime >= 0)
    .sort((a, b) => a.startTime - b.startTime);

  // hasPart/Clip is how a video earns the "Key moments" treatment in video
  // SERPs. Each clip deep-links to the moment (?t=), which the player reads.
  const hasPart = chapters.length
    ? chapters.map((chapter, i) => {
        const start = Math.round(chapter.startTime);
        const next = chapters[i + 1];
        const rawEnd = next ? next.startTime : Math.max(video.durationSeconds, chapter.startTime);
        return {
          "@type": "Clip",
          name: chapter.title,
          startOffset: start,
          // Google needs the end strictly after the start; a chapter pinned at
          // the very end of a video still gets a usable one-second window.
          endOffset: Math.max(start + 1, Math.round(rawEnd)),
          url: `${pageUrl}?t=${start}`,
        };
      })
    : undefined;

  return [
    {
      "@type": "VideoObject",
      "@id": `${pageUrl}#video`,
      name: video.title,
      description,
      thumbnailUrl: [video.thumbnailUrl],
      // uploadDate is the original YouTube upload — Google's video rich result
      // reads it as the video's age.
      uploadDate: new Date(video.publishedAt).toISOString(),
      // The page's own dates are curation dates: this library resurfaces old
      // uploads, so claiming the upload date as publication would make every
      // page look years stale.
      datePublished: new Date(video.curatedAt).toISOString(),
      dateModified: new Date(video.curatedAt).toISOString(),
      duration: isoDuration(video.durationSeconds),
      embedUrl: `https://www.youtube.com/embed/${video.youtubeId}`,
      contentUrl: `https://www.youtube.com/watch?v=${video.youtubeId}`,
      author: { "@type": "Person", name: video.channelName },
      // The channel made the video; the curator published this page about it.
      contributor: { "@id": personId(base) },
      publisher: { "@id": organizationId(base) },
      isPartOf: { "@id": websiteId(base) },
      ...(hasPart ? { hasPart } : {}),
    },
    {
      // The page itself, authored by the curator, with the VideoObject as its
      // main entity. This is what gives Google a Person (not the channel) to
      // attribute the article to, and binds the page to the breadcrumb trail.
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: video.title,
      // The curator's own words describe the page when they exist.
      ...(video.editorialNote
        ? { description: truncateWords(video.editorialNote, 300) }
        : {}),
      isPartOf: { "@id": websiteId(base) },
      author: { "@id": personId(base) },
      mainEntity: { "@id": `${pageUrl}#video` },
      breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      primaryImageOfPage: { "@type": "ImageObject", url: video.thumbnailUrl },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${pageUrl}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: base },
        {
          "@type": "ListItem",
          position: 2,
          name: video.category,
          item: `${base}/category/${categorySlug(video.category)}`,
        },
        { "@type": "ListItem", position: 3, name: video.title, item: pageUrl },
      ],
    },
  ];
}
