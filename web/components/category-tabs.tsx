import Link from "next/link";

export default function CategoryTabs({
  categories,
  active,
}: {
  categories: string[];
  active: string;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-px">
      {categories.map((cat) => {
        const href = cat === "All" ? "/" : `/?category=${encodeURIComponent(cat)}`;
        return (
          <Link
            key={cat}
            href={href}
            className={[
              "shrink-0 rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors",
              active === cat
                ? "bg-(--color-accent) text-(--color-accent-foreground)"
                : "text-(--color-muted-foreground) hover:text-(--color-foreground)",
            ].join(" ")}
          >
            {cat}
          </Link>
        );
      })}
    </div>
  );
}
