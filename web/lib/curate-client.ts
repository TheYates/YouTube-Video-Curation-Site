// Client helper for the `curate` edge function (approve/reject candidates,
// manage source channels + saved searches). Sends the signed-in curator's
// access token — the function verifies the email against ADMIN_EMAILS
// server-side. All notifications are toasts (sonner), per project convention.

import { toast } from "sonner";
import { getBrowserSupabase } from "./supabase-browser";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type CurateAction =
  | { action: "approve-candidate"; id: string }
  | { action: "reject-candidate"; id: string }
  | { action: "add-channel"; handle: string; name?: string; category: string; description?: string }
  | { action: "remove-channel"; id: string }
  | { action: "toggle-channel"; id: string; enabled: boolean }
  | { action: "add-query"; query: string; category: string }
  | { action: "remove-query"; id: string }
  | { action: "toggle-query"; id: string; enabled: boolean };

export async function curate(payload: CurateAction): Promise<Record<string, unknown> | null> {
  const sb = getBrowserSupabase();
  const {
    data: { session },
  } = (await sb?.auth.getSession()) ?? { data: { session: null } };
  const accessToken = session?.access_token ?? "";
  if (!accessToken) {
    toast.error("No active session. Sign in to /admin again.");
    return null;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/curate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(String(body.error ?? `Curation request failed (HTTP ${res.status})`));
      return null;
    }
    return body;
  } catch {
    toast.error("Curation request failed — check your connection and the function logs.");
    return null;
  }
}
