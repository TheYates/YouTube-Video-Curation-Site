import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getPublicCategories, getVideoCards } from "../../../../lib/videos";
import { categoryFromSlug, categorySlug } from "../../../../lib/category";
import { siteUrl } from "../../../../lib/site-url";
import VideoCard from "../../../../components/video-card";
import AdSlot from "../../../../components/ad-slot";

// A hub is a landing page, not a feed: it only changes when a video is added to
// the category, so a longer window than the homepage's is fine.
export const revalidate = 600;

// Resolved from the live category list rather than a stored map, so a rename in
// /admin/categories moves the hub instead of orphaning it. Cached with React's
// cache() because generateMetadata and the page both need it — one query, not
// two.
//
// Deliberately resolves against *all* categories, not just the ones above the
// curator's minimum-size threshold: video pages link their category badge here,
// so a category that drops below the threshold must not start 404-ing out from
// under those links. The threshold decides what we advertise (sitemap) and
// surface in nav, not what is allowed to exist.
const resolveCategory = cache(async (slug: string): Promise<string | null> => {
  const categories = await getCategories().catch(() => ["All"]);
  return categoryFromSlug(categories, slug);
});

// Prerender every hub. Without this the route is dynamic and every crawler hit
// is a cold Supabase query, which is the pattern that made /video/[slug]
// expensive for Googlebot.
export async function generateStaticParams() {
  const categories = await getCategories().catch(() => ["All"]);
  return categories.filter((c) => c !== "All").map((c) => ({ slug: categorySlug(c) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await resolveCategory(slug);
  if (!category) return { title: "Category not found" };
  const description = `Every ${category} video in the library, transcribed and analysed. Click any word in a transcript to jump to that exact moment.`;
  return {
    title: `${category} videos, transcribed and searchable`,
    description,
    alternates: { canonical: `/category/${slug}` },
    openGraph: {
      title: `${category} videos — Signal`,
      description,
      type: "website",
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await resolveCategory(slug);
  if (!category) notFound();

  const [videos, navCategories] = await Promise.all([
    getVideoCards(category),
    // Sibling links use the threshold-filtered set, so the nav never points at
    // a section the curator has decided is too thin to surface.
    getPublicCategories().catch(() => ["All"]),
  ]);

  const base = siteUrl();

  // CollectionPage + ItemList gives Google an explicit "this is one collection,
  // in this order" statement instead of a loose list of links. numberOfItems
  // makes the shape of the page unambiguous even if a crawler truncates.
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category} videos`,
    url: `${base}/category/${slug}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: videos.length,
      itemListElement: videos.map((v, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${base}/video/${v.slug}`,
      })),
    },
  };

  // Home → Category gives the hubs a real place in the site hierarchy rather
  // than leaving Google to infer one from the feed.
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: category, item: `${base}/category/${slug}` },
    ],
  };

  const siblings = navCategories.filter((c) => c !== "All" && c !== category);

  return (
    <main className="page-enter mx-auto max-w-5xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav
        aria-label="Breadcrumb"
        className="mb-8 font-mono text-xs uppercase tracking-widest text-(--color-muted-foreground)"
      >
        <Link href="/" className="transition-colors hover:text-(--color-foreground)">
          Home
        </Link>
        <span className="mx-2 text-(--color-border)">/</span>
        <span className="text-(--color-foreground)">{category}</span>
      </nav>

      <div className="mb-12 border-b border-(--color-border) pb-12">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-(--color-accent)">
          Category
        </p>
        <h1 className="font-display text-5xl leading-tight text-(--color-foreground)">
          {category}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-(--color-muted-foreground)">
          {videos.length} hand-picked {category} video{videos.length === 1 ? "" : "s"}, each one
          transcribed and analysed. Click any word in a transcript to jump to that exact moment.
        </p>
      </div>

      <AdSlot size="leaderboard" />

      <div>
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>

      {siblings.length > 0 && (
        <div className="mt-16 border-t border-(--color-border) pt-10 pb-8">
          <h2 className="mb-5 font-mono text-xs uppercase tracking-widest text-(--color-accent)">
            Browse other categories
          </h2>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {siblings.map((c) => (
              <Link
                key={c}
                href={`/category/${categorySlug(c)}`}
                className="font-mono text-xs uppercase tracking-widest text-(--color-muted-foreground) transition-colors hover:text-(--color-foreground)"
              >
                {c}
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
