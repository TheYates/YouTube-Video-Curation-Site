interface Props {
  categories: string[]
  active: string
  onChange: (cat: string) => void
}

export default function CategoryTabs({ categories, active, onChange }: Props) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-px">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={[
            "flex-shrink-0 rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors",
            active === cat
              ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
          ].join(" ")}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
