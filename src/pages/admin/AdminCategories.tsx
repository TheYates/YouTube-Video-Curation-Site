import { useState } from "react"
import { useVideos, useCategories } from "../../hooks/useVideos"

export default function AdminCategories() {
  const { data: videos = [], isPending, isError } = useVideos("All")
  const { data: catsQuery = ["All"] } = useCategories()
  const [cats, setCats] = useState<string[] | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [newCat, setNewCat] = useState("")
  const [error, setError] = useState("")

  const base = catsQuery.filter((c) => c !== "All")
  const list = cats ?? base

  function countVideos(cat: string) {
    return videos.filter((v) => v.category === cat).length
  }

  if (isPending) {
    return <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>Loading categories…</p>
  }
  if (isError) {
    return <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>Something went wrong loading categories.</p>
  }

  function startEdit(cat: string) {
    setEditing(cat)
    setEditValue(cat)
  }

  function confirmEdit(oldName: string) {
    const trimmed = editValue.trim()
    if (!trimmed) return
    if (list.includes(trimmed) && trimmed !== oldName) {
      setError("A category with that name already exists.")
      return
    }
    setCats(list.map((c) => (c === oldName ? trimmed : c)))
    setEditing(null)
    setError("")
  }

  function handleDelete(cat: string) {
    if (countVideos(cat) > 0) return
    setCats(list.filter((c) => c !== cat))
  }

  function handleAdd() {
    const trimmed = newCat.trim()
    if (!trimmed) return
    if (list.includes(trimmed)) {
      setError("Category already exists.")
      return
    }
    setCats([...list, trimmed])
    setNewCat("")
    setError("")
  }

  return (
    <div className="max-w-lg space-y-8">
      {/* Category list */}
      <div
        className="rounded-sm border overflow-hidden"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        {list.length === 0 ? (
          <p className="py-10 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
            No categories yet.
          </p>
        ) : (
          list.map((cat, i) => {
            const count = countVideos(cat)
            const isEditing = editing === cat
            return (
              <div
                key={cat}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-muted)]"
                style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
              >
                {/* Drag handle (visual only) */}
                <span className="flex-shrink-0 cursor-grab select-none text-lg leading-none" style={{ color: "var(--color-border)" }}>
                  ⠿
                </span>

                {isEditing ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmEdit(cat)
                        if (e.key === "Escape") setEditing(null)
                      }}
                      className="flex-1 rounded-sm border px-3 py-1.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
                      style={{
                        borderColor: "var(--color-border)",
                        background: "var(--color-muted)",
                        color: "var(--color-foreground)",
                      }}
                    />
                    <button
                      onClick={() => confirmEdit(cat)}
                      className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)]"
                      style={{ color: "var(--color-muted-foreground)" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="font-mono text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                      {cat}
                    </span>
                    <span
                      className="rounded-sm px-2 py-0.5 font-mono text-[10px]"
                      style={{ background: "var(--color-muted)", color: "var(--color-accent)" }}
                    >
                      {count} video{count !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => startEdit(cat)}
                      className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)]"
                      style={{ color: "var(--color-muted-foreground)" }}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      disabled={count > 0}
                      title={count > 0 ? "Remove all videos first" : "Delete category"}
                      className="font-mono text-xs text-red-500 transition-colors hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Add category */}
      <div>
        <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
          Add Category
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="e.g. Psychology"
            className="flex-1 rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-muted)",
              color: "var(--color-foreground)",
            }}
          />
          <button
            onClick={handleAdd}
            disabled={!newCat.trim()}
            className="rounded-sm px-5 py-2.5 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
          >
            Add
          </button>
        </div>
      </div>

      <div
        className="rounded-sm border px-4 py-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-muted)" }}
      >
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
          Categories with existing videos cannot be deleted. Rename them freely — video assignments will follow.
          Order here is visual only; the homepage always sorts alphabetically.
        </p>
      </div>
    </div>
  )
}
