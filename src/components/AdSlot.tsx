interface Props {
  size: "leaderboard" | "rectangle"
}

export default function AdSlot({ size }: Props) {
  const isLeaderboard = size === "leaderboard"
  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-sm border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]",
        isLeaderboard ? "w-full h-24" : "w-full h-64 max-w-xs",
      ].join(" ")}
    >
      <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted-foreground)]">
        Advertisement
      </p>
      <p className="mt-1 font-mono text-[10px] text-[var(--color-muted-foreground)]/60">
        This space is available for display advertising
      </p>
    </div>
  )
}
