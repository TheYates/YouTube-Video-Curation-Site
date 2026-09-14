// Loading skeletons for /admin pages (replaces "Loading…" text).
// Variants mirror each page's layout: stat tiles, data table, plain list,
// and the video edit form. Theme-matched via CSS vars; purely presentational.

const bar = "animate-pulse rounded-sm bg-[var(--color-muted)]";

function StatTiles() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {["a", "b", "c", "d"].map((k) => (
        <div
          key={k}
          className="rounded-sm border p-5"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          <div className={`mb-3 h-2 w-1/2 ${bar}`} />
          <div className={`h-6 w-2/3 ${bar}`} />
        </div>
      ))}
    </div>
  );
}

function TableRows() {
  return (
    <div>
      <div className="mb-6 flex gap-3">
        <div className={`h-10 flex-1 ${bar}`} />
        <div className={`hidden h-10 w-32 sm:block ${bar}`} />
      </div>
      <div
        className="overflow-hidden rounded-sm border"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
          >
            <div className={`h-9 w-14 shrink-0 ${bar}`} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`h-3 w-2/3 ${bar}`} />
              <div className={`h-2 w-1/3 ${bar}`} />
            </div>
            <div className={`hidden h-3 w-16 sm:block ${bar}`} />
            <div className={`hidden h-3 w-16 md:block ${bar}`} />
            <div className={`hidden h-3 w-20 lg:block ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ListRows() {
  return (
    <div
      className="max-w-lg overflow-hidden rounded-sm border"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-5 py-4"
          style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
        >
          <div className={`h-3 flex-1 ${bar}`} />
          <div className={`h-3 w-10 ${bar}`} />
        </div>
      ))}
    </div>
  );
}

function FormFields() {
  return (
    <div className="max-w-2xl space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className={`h-2 w-24 ${bar}`} />
          <div className={`h-10 w-full ${bar}`} />
        </div>
      ))}
      <div className="space-y-2">
        <div className={`h-2 w-24 ${bar}`} />
        <div className={`h-28 w-full ${bar}`} />
      </div>
      <div className={`h-10 w-32 ${bar}`} />
    </div>
  );
}

export default function AdminSkeleton({
  variant = "stats",
}: {
  variant?: "stats" | "table" | "list" | "form";
}) {
  return (
    <div role="status" aria-label="Loading">
      {variant === "stats" && (
        <div className="space-y-10">
          <StatTiles />
          <div
            className="space-y-3 rounded-sm border p-5"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
          >
            <div className={`h-3 w-full ${bar}`} />
            <div className={`h-3 w-5/6 ${bar}`} />
            <div className={`h-3 w-2/3 ${bar}`} />
          </div>
        </div>
      )}
      {variant === "table" && <TableRows />}
      {variant === "list" && <ListRows />}
      {variant === "form" && <FormFields />}
    </div>
  );
}
