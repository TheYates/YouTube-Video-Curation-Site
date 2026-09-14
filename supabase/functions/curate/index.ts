// Curator writes for the discovery pipeline: approve/reject candidates,
// manage source channels and saved search queries. All writes go through the
// service role (bypasses RLS — there are deliberately no write policies on
// these tables).
//
// POST { action, ...payload } with the signed-in curator's access token:
//   { action: "approve-candidate", id }        → status approved
//   { action: "reject-candidate",  id }        → status rejected
//   { action: "add-channel",   handle, name?, category, description? }
//   { action: "remove-channel", id }
//   { action: "add-query",     query, category }
//   { action: "remove-query",  id }
//   { action: "toggle-channel", id, enabled }
//   { action: "toggle-query",   id, enabled }
//
// Auth (same pattern as supabase/functions/ingest): the gateway's verify_jwt
// rejects anonymous calls, then this function verifies the caller's email
// against the ADMIN_EMAILS allow-list BEFORE any YouTube quota is spent.
//
// Deploy:  supabase functions deploy curate
// Secrets: supabase secrets set ADMIN_EMAILS="you@example.com,other@example.com"
//          supabase secrets set YOUTUBE_API_KEY=...   (for handle → ID lookup)

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS })
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405)

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Server misconfigured: missing SUPABASE_URL / service role." }, 500)
  }

  // ── Curator auth (defense in depth, before any quota spend) ──
  const authHeader = req.headers.get("authorization") ?? ""
  const callerJwt = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : ""
  if (!callerJwt) return json({ error: "Missing user session. Sign in to /admin first." }, 401)

  const sb = createClient(SUPABASE_URL, SERVICE_KEY)
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser(callerJwt)
  const allowList = (Deno.env.get("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const callerEmail = user?.email?.toLowerCase() ?? ""
  if (userErr || !user || !allowList.includes(callerEmail)) {
    console.error(`[curate] forbidden for ${callerEmail || "unknown"}: ${userErr?.message ?? "not allow-listed"}`)
    return json({ error: "Forbidden: curator allow-list only." }, 403)
  }

  // ── Parse request ──
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: "Expected JSON body." }, 400)
  }
  const action = String(body.action ?? "")

  // ── Candidate decisions ──
  if (action === "approve-candidate" || action === "reject-candidate") {
    const id = String(body.id ?? "")
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Invalid candidate id." }, 400)
    const status = action === "approve-candidate" ? "approved" : "rejected"
    const { error } = await sb
      .from("video_candidates")
      .update({ status, decided_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return json({ error: `Update failed: ${error.message}` }, 500)
    return json({ ok: true, id, status })
  }

  // ── Source channels ──
  if (action === "add-channel") {
    const handle = String(body.handle ?? "").trim().replace(/^@/, "")
    const name = String(body.name ?? "").trim()
    const category = String(body.category ?? "").trim()
    const description = String(body.description ?? "").trim() || "Curator pick"
    if (!handle || !category) return json({ error: "Handle and category are required." }, 400)

    if (!YOUTUBE_API_KEY) {
      return json({ error: "YOUTUBE_API_KEY secret not set — cannot resolve the handle." }, 500)
    }
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${YOUTUBE_API_KEY}`,
      { headers: { "User-Agent": UA } },
    )
    if (!res.ok) return json({ error: `YouTube API error (HTTP ${res.status}).` }, 502)
    const channelId = (await res.json()).items?.[0]?.id
    if (!channelId) return json({ error: `No YouTube channel found for @${handle}.` }, 404)

    // Upsert on channel_id: re-adding a previously removed channel restores it.
    const { error } = await sb.from("source_channels").upsert(
      { channel_id: channelId, handle, name: name || handle, category, description, builtin: false, enabled: true },
      { onConflict: "channel_id" },
    )
    if (error) return json({ error: `Insert failed: ${error.message}` }, 500)
    return json({ ok: true, channelId, handle, name: name || handle })
  }

  if (action === "remove-channel") {
    const id = String(body.id ?? "")
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Invalid channel id." }, 400)
    const { error } = await sb.from("source_channels").delete().eq("id", id)
    if (error) return json({ error: `Delete failed: ${error.message}` }, 500)
    return json({ ok: true, id })
  }

  if (action === "toggle-channel") {
    const id = String(body.id ?? "")
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Invalid channel id." }, 400)
    const { error } = await sb.from("source_channels").update({ enabled: body.enabled === true }).eq("id", id)
    if (error) return json({ error: `Update failed: ${error.message}` }, 500)
    return json({ ok: true, id, enabled: body.enabled === true })
  }

  // ── Saved search queries ──
  if (action === "add-query") {
    const query = String(body.query ?? "").trim()
    const category = String(body.category ?? "").trim()
    if (!query || !category) return json({ error: "Query and category are required." }, 400)
    if (query.length > 200) return json({ error: "Query too long (max 200 chars)." }, 400)
    const { error } = await sb.from("search_queries").insert({ query, category })
    if (error) {
      const dupe = error.code === "23505" || /duplicate|unique/i.test(error.message ?? "")
      return json({ error: dupe ? "That query already exists." : `Insert failed: ${error.message}` }, dupe ? 409 : 500)
    }
    return json({ ok: true, query, category })
  }

  if (action === "remove-query") {
    const id = String(body.id ?? "")
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Invalid query id." }, 400)
    const { error } = await sb.from("search_queries").delete().eq("id", id)
    if (error) return json({ error: `Delete failed: ${error.message}` }, 500)
    return json({ ok: true, id })
  }

  if (action === "toggle-query") {
    const id = String(body.id ?? "")
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Invalid query id." }, 400)
    const { error } = await sb.from("search_queries").update({ enabled: body.enabled === true }).eq("id", id)
    if (error) return json({ error: `Update failed: ${error.message}` }, 500)
    return json({ ok: true, id, enabled: body.enabled === true })
  }

  return json({ error: `Unknown action: ${action || "(empty)"}` }, 400)
})
