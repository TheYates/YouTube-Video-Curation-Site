"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { listAdminVideos } from "@/lib/admin-data";

const RELAY_URL = process.env.NEXT_PUBLIC_INGEST_RELAY_URL ?? "http://127.0.0.1:8917";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type StepStatus = "idle" | "running" | "done";
type BatchStatus = "pending" | "running" | "ok" | "skipped" | "failed";

interface Step {
  label: string;
  status: StepStatus;
}

interface BatchItem {
  url: string;
  youtubeId: string;
  status: BatchStatus;
  detail?: string;
}

const INITIAL_STEPS: Step[] = [
  { label: "Fetching video metadata", status: "idle" },
  { label: "Extracting transcript (captions → Whisper)", status: "idle" },
  { label: "Generating AI summary & chapters", status: "idle" },
  { label: "Publishing page", status: "idle" },
];

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:v=|vi=|shorts\/|live\/|embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function parseUrls(text: string): { url: string; youtubeId: string | null }[] {
  const seen = new Set<string>();
  const out: { url: string; youtubeId: string | null }[] = [];
  for (const line of text.split("\n")) {
    const url = line.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, youtubeId: extractYouTubeId(url) });
  }
  return out;
}

export default function AdminIngestPage() {
  const router = useRouter();
  const [urlsText, setUrlsText] = useState("");
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [relayDown, setRelayDown] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [recentTitles, setRecentTitles] = useState<{ id: string; title: string }[]>([]);

  const goToLibraryAction = { label: "Go to library", onClick: () => router.push("/admin/videos") };

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    listAdminVideos(sb)
      .then((rows) => setRecentTitles(rows.slice(0, 3).map((r) => ({ id: r.id, title: r.title }))))
      .catch(() => {});
  }, []);

  async function runRealPipeline(ytUrl: string, via: "auto" | "cloud" = "auto") {
    setRelayDown(false);
    setProcessing(true);
    setDone(false);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "idle" as StepStatus })));

    let stage = 0;
    const tick = setInterval(() => {
      stage = Math.min(stage + 1, 2);
      setSteps((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx < stage ? "done" : idx === stage ? "running" : "idle",
        }))
      );
    }, 4000);

    const finish = (warning: string) => {
      clearInterval(tick);
      setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as StepStatus })));
      setProcessing(false);
      setDone(true);
      setUrlsText("");
      if (warning) {
        toast.warning(warning, { action: goToLibraryAction });
      } else {
        toast.success("Page published");
        setTimeout(() => router.push("/admin/videos"), 1800);
      }
    };
    const fail = (message: string) => {
      clearInterval(tick);
      setProcessing(false);
      setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "idle" as StepStatus })));
      toast.error(message);
    };

    if (via === "auto") {
      try {
        const health = await fetch(`${RELAY_URL}/health`, {
          signal: AbortSignal.timeout(2500),
        });
        if (!health.ok) throw new Error("unhealthy");
      } catch {
        clearInterval(tick);
        setProcessing(false);
        setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "idle" as StepStatus })));
        setRelayDown(true);
        return;
      }
      try {
        const res = await fetch(`${RELAY_URL}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtubeUrl: ytUrl }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `Local ingest failed (HTTP ${res.status})`);
        let warning = "";
        if (body.transcriptSource === "none") {
          warning = "Published without a transcript — no captions found. The video may have captions disabled.";
        } else if (!body.aiOk) {
          warning = "Published with a placeholder summary — the Groq call failed. Verify GROQ_API_KEY in scripts/.env.";
        }
        finish(warning);
        return;
      } catch (e) {
        fail(e instanceof Error ? e.message : "Local ingest failed. Is the relay still running?");
        return;
      }
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ youtubeUrl: ytUrl }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Ingest failed (HTTP ${res.status})`);
      let warning = "";
      if (body.transcriptSource === "none") {
        warning = "Published without a transcript — no captions found and the Whisper fallback failed. See the function logs in Supabase.";
      } else if (!body.aiOk) {
        warning = "Published with a placeholder summary — the Groq call failed. Verify GROQ_API_KEY in function secrets.";
      }
      finish(warning);
    } catch (e) {
      fail(e instanceof Error ? e.message : "Ingest failed. Check the function logs in Supabase.");
    }
  }

  async function runBatch(urlList: string[]) {
    setRelayDown(false);
    setProcessing(true);
    setDone(false);
    setBatchItems(
      urlList.map((u) => ({ url: u, youtubeId: extractYouTubeId(u) ?? "", status: "pending" as BatchStatus }))
    );

    try {
      const health = await fetch(`${RELAY_URL}/health`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!health.ok) throw new Error("unhealthy");
    } catch {
      setProcessing(false);
      setBatchItems([]);
      setRelayDown(true);
      return;
    }

    try {
      const res = await fetch(`${RELAY_URL}/ingest-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: urlList }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Batch failed (HTTP ${res.status})`);
      }
      if (!res.body) throw new Error("Empty response from relay.");
      setBatchItems((prev) =>
        prev.map((it, i) => ({ ...it, status: i === 0 ? ("running" as BatchStatus) : it.status }))
      );
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.done) {
            setProcessing(false);
            setDone(true);
            setUrlsText("");
            const summary = `Batch complete: ${msg.ok ?? 0} ok · ${msg.skipped ?? 0} skipped · ${msg.failed ?? 0} failed`;
            if ((msg.failed ?? 0) > 0) {
              toast.warning(summary, { action: goToLibraryAction });
            } else {
              toast.success(summary, { action: goToLibraryAction });
            }
            continue;
          }
          setBatchItems((prev) =>
            prev.map((it, i) => {
              if (i === msg.i) {
                return { ...it, status: msg.status as BatchStatus, detail: msg.detail };
              }
              if (i === msg.i + 1 && it.status === "pending") {
                return { ...it, status: "running" as BatchStatus };
              }
              return it;
            })
          );
        }
      }
    } catch (e) {
      setProcessing(false);
      toast.error(e instanceof Error ? e.message : "Batch ingest failed. Is the relay still running?");
    }
  }

  function runPipeline() {
    const entries = parseUrls(urlsText);
    if (!entries.length) {
      toast.error("Paste at least one YouTube URL (one per line for batches).");
      return;
    }
    const invalid = entries.filter((e) => !e.youtubeId);
    if (invalid.length === entries.length) {
      toast.error("Could not parse a YouTube video ID from that URL. Try pasting the full URL.");
      return;
    }
    const valid = entries.filter((e) => e.youtubeId).map((e) => e.url);
    if (valid.length === 1 && invalid.length === 0) {
      runRealPipeline(valid[0]);
      return;
    }
    runBatch(valid);
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
          Paste YouTube URLs — one per line for batches. The pipeline fetches metadata, extracts the
          transcript, generates an AI summary and chapter markers, then publishes each page.
        </p>
      </div>

      <div
        className="rounded-sm border p-6 space-y-4"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <label
          className="block font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          YouTube URLs (one per line)
        </label>
        <div className="flex gap-3">
          <textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            placeholder={"https://www.youtube.com/watch?v=…\nhttps://youtu.be/…"}
            disabled={processing}
            rows={4}
            className="flex-1 rounded-sm border px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-accent)] disabled:opacity-50"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-muted)",
              color: "var(--color-foreground)",
            }}
          />
          <button
            onClick={runPipeline}
            disabled={processing || !urlsText.trim()}
            className="self-start rounded-sm px-5 py-3 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
          >
            {processing ? "Processing…" : "Process"}
          </button>
        </div>

        {relayDown && (
          <div className="rounded-sm border border-amber-500/50 bg-amber-500/10 px-4 py-3 space-y-2">
            <p className="text-xs leading-relaxed text-amber-700">
              Local ingest relay isn’t reachable at {RELAY_URL}. Start it with{" "}
              <code className="font-mono">npm run ingest:serve</code> (uses scripts/.env, localhost
              only), then press Process again. On hosted deployments the relay isn’t available — use
              cloud ingest below.
            </p>
            {(() => {
              const first = parseUrls(urlsText).find((e) => e.youtubeId)?.url ?? "";
              return (
                <button
                  onClick={() => {
                    setRelayDown(false);
                    runRealPipeline(first, "cloud");
                  }}
                  disabled={processing || !first}
                  className="font-mono text-xs uppercase tracking-widest text-amber-700 hover:underline disabled:opacity-40"
                >
                  Try cloud ingest anyway (single video, often blocked by YouTube) →
                </button>
              );
            })()}
          </div>
        )}

        {batchItems.length > 0 && (
          <div className="space-y-2 pt-2">
            {batchItems.map((it, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-4 shrink-0 pt-1 text-center">
                  {(it.status === "ok" || it.status === "skipped") && (
                    <svg
                      className="inline"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      style={{
                        color:
                          it.status === "ok"
                            ? "var(--color-accent)"
                            : "var(--color-muted-foreground)",
                      }}
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                  {it.status === "running" && (
                    <span
                      className="inline-block h-3 w-3 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }}
                    />
                  )}
                  {it.status === "pending" && (
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--color-border)" }}
                    />
                  )}
                  {it.status === "failed" && (
                    <span className="font-mono text-xs font-bold text-red-600">✕</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs" style={{ color: "var(--color-foreground)" }}>
                    {it.youtubeId}{" "}
                    <span style={{ color: "var(--color-muted-foreground)" }}>
                      · {it.status}
                      {it.status === "running" && "…"}
                    </span>
                  </p>
                  {(it.status === "failed" || it.status === "skipped") && it.detail && (
                    <p
                      className="mt-0.5 break-words text-xs leading-relaxed"
                      style={{ color: it.status === "failed" ? "#dc2626" : "var(--color-muted-foreground)" }}
                    >
                      {it.detail.length > 220 ? it.detail.slice(0, 220) + "…" : it.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {batchItems.length === 0 && (processing || done) && (
          <div className="space-y-3 pt-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-center">
                  {step.status === "done" && (
                    <svg
                      className="inline"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      style={{ color: "var(--color-accent)" }}
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                  {step.status === "running" && (
                    <span
                      className="inline-block h-3 w-3 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }}
                    />
                  )}
                  {step.status === "idle" && (
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--color-border)" }}
                    />
                  )}
                </span>
                <span
                  className="text-sm"
                  style={{
                    color:
                      step.status === "done"
                        ? "var(--color-foreground)"
                        : "var(--color-muted-foreground)",
                  }}
                >
                  {step.label}
                  {step.status === "running" && "…"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="rounded-sm border px-4 py-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-muted)" }}
      >
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
          <span style={{ color: "var(--color-foreground)" }}>Live pipeline:</span> This uses your
          local ingest relay (npm run ingest:serve), which runs YouTube metadata → yt-dlp captions →
          Groq on your machine. YouTube blocks datacenter IPs, so cloud ingest usually fails.
        </p>
      </div>

      <div className="border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
        <p
          className="mb-3 font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          Recently in Library
        </p>
        <div className="space-y-2">
          {recentTitles.map((v) => (
            <div key={v.id} className="flex items-center justify-between">
              <p className="text-sm truncate max-w-xs" style={{ color: "var(--color-foreground)" }}>
                {v.title}
              </p>
              <Link
                href={`/admin/videos/${v.id}`}
                className="ml-4 font-mono text-xs transition-colors hover:text-[var(--color-accent)]"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                Edit →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
