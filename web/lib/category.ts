// Category hub URLs use a slug derived from the category name.
//
// Unlike video slugs (frozen at publish so shared links never break), a
// category slug is derived on every render and resolved against the live
// category list. Categories are curator-editable free text, so renaming one in
// /admin/categories intentionally changes its hub URL — there is no stored
// mapping to drift out of sync.
export function categorySlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Resolve a hub slug back to the canonical category name. "All" is excluded:
// it is a feed filter, not a category.
export function categoryFromSlug(categories: string[], slug: string): string | null {
  return categories.find((c) => c !== "All" && categorySlug(c) === slug) ?? null;
}
