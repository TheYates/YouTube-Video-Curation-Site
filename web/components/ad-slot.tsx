// Placeholder slots stay invisible until real ads go live — a labeled
// "advertising available" box reads unfinished to visitors and ad reviewers.
const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

export default function AdSlot({ size }: { size: "leaderboard" | "rectangle" }) {
  if (!ADS_ENABLED) return null;
  const isLeaderboard = size === "leaderboard";
  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-sm border border-dashed border-(--color-border) bg-(--color-muted)",
        isLeaderboard ? "w-full h-24 mb-8" : "w-full h-64 max-w-xs",
      ].join(" ")}
    >
      <p className="font-mono text-xs uppercase tracking-widest text-(--color-muted-foreground)">
        Advertisement
      </p>
      <p className="mt-1 font-mono text-[10px] text-(--color-muted-foreground)/60">
        This space is available for display advertising
      </p>
    </div>
  );
}
