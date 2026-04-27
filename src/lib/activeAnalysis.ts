import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "offeriq.activeAnalysisId";

export function getStoredActiveAnalysisId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveAnalysisId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
    // Notify same-tab listeners (storage event only fires cross-tab)
    window.dispatchEvent(new Event("offeriq:active-analysis-changed"));
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the active analysis ID for the current navigation.
 * Priority: explicit URL ?analysis= → localStorage → most recently
 * updated analysis owned by `userId` → null.
 * Also persists the chosen ID to localStorage so subsequent sidebar
 * navigation stays inside the same deal.
 */
export async function resolveActiveAnalysisId(
  userId: string,
  searchParams?: URLSearchParams,
): Promise<string | null> {
  const fromUrl = searchParams?.get("analysis") ?? null;
  if (fromUrl) {
    // Verify ownership before trusting the URL.
    const { data } = await supabase
      .from("deal_analyses")
      .select("id")
      .eq("id", fromUrl)
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.id) {
      setStoredActiveAnalysisId(data.id);
      return data.id;
    }
  }

  const stored = getStoredActiveAnalysisId();
  if (stored) {
    const { data } = await supabase
      .from("deal_analyses")
      .select("id")
      .eq("id", stored)
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.id) return data.id;
    // Stored ID no longer exists; clear it.
    setStoredActiveAnalysisId(null);
  }

  const { data: latest } = await supabase
    .from("deal_analyses")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.id) {
    setStoredActiveAnalysisId(latest.id);
    return latest.id;
  }
  return null;
}

/** Fetch a single analysis (with property) by ID, scoped to user. */
export async function fetchAnalysisById(userId: string, analysisId: string) {
  const { data, error } = await supabase
    .from("deal_analyses")
    .select("*, properties(*)")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Lightweight summary of all user analyses for a picker UI. */
export async function fetchAnalysisSummariesForUser(userId: string) {
  const { data, error } = await supabase
    .from("deal_analyses")
    .select("id, name, updated_at, property_id, properties(address, city, listing_price)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    name: string;
    updated_at: string;
    property_id: string;
    properties: { address: string | null; city: string | null; listing_price: number | null } | null;
  }>;
}

export const ACTIVE_ANALYSIS_EVENT = "offeriq:active-analysis-changed";