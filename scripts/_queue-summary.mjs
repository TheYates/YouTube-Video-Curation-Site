// TEMP probe — safe to delete. Summarizes the pending review queue.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { count } = await sb
  .from("video_candidates")
  .select("*", { count: "exact", head: true })
  .eq("status", "pending");
console.log(`pending total: ${count}\n`);

const { data: via } = await sb.rpc; // (unused placeholder — see below)

// Grouped breakdowns via plain selects (no RPCs available).
const { data: rows } = await sb
  .from("video_candidates")
  .select("discovered_via,suggested_category,channel_name,title,reason")
  .eq("status", "pending")
  .limit(1000);

const tally = (key) =>
  Object.entries(
    rows.reduce((acc, r) => {
      const k = r[key] ?? "(null)";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

console.log("by discovered_via:");
for (const [k, n] of tally("discovered_via")) console.log(`  ${k}: ${n}`);
console.log("\nby suggested_category:");
for (const [k, n] of tally("suggested_category")) console.log(`  ${k}: ${n}`);
console.log("\ntop channel names:");
for (const [k, n] of tally("channel_name").slice(0, 12)) console.log(`  ${k}: ${n}`);
