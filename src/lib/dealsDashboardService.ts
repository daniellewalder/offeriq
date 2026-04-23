import { supabase } from "@/integrations/supabase/client";

export type PortalStatus = "not_shared" | "shared" | "viewed" | "revoked";

export interface DealCard {
  analysisId: string;
  name: string;
  status: string | null;
  topRecommendation: string | null;
  createdAt: string;
  updatedAt: string;
  property: {
    id: string;
    address: string;
    city: string | null;
    listingPrice: number | null;
  };
  offerCount: number;
  portal: {
    id: string;
    token: string;
    title: string | null;
    createdAt: string;
    lastAccessedAt: string | null;
    revokedAt: string | null;
    viewCount: number;
    portalUrl: string;
    status: PortalStatus;
  } | null;
}

function statusFor(p: {
  revoked_at: string | null;
  last_accessed_at: string | null;
}): PortalStatus {
  if (p.revoked_at) return "revoked";
  if (p.last_accessed_at) return "viewed";
  return "shared";
}

export async function fetchDealCardsForUser(
  userId: string,
  limit = 8,
): Promise<DealCard[]> {
  // 1. Pull recent analyses for this user.
  const { data: analyses, error } = await supabase
    .from("deal_analyses")
    .select(
      "id, name, status, top_recommendation, created_at, updated_at, property_id",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!analyses || analyses.length === 0) return [];

  const propertyIds = Array.from(
    new Set(analyses.map((a) => a.property_id).filter(Boolean)),
  ) as string[];
  const analysisIds = analyses.map((a) => a.id);

  // 2. Fetch related properties, portals, and offer counts in parallel.
  const [propsRes, portalsRes, offersRes] = await Promise.all([
    supabase
      .from("properties")
      .select("id, address, city, listing_price")
      .in("id", propertyIds.length ? propertyIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("shared_portals")
      .select(
        "id, token, title, created_at, last_accessed_at, revoked_at, view_count, deal_analysis_id",
      )
      .eq("user_id", userId)
      .in("deal_analysis_id", analysisIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("offers")
      .select("id, deal_analysis_id")
      .eq("user_id", userId)
      .in("deal_analysis_id", analysisIds),
  ]);

  const propsById = new Map<string, any>();
  (propsRes.data ?? []).forEach((p) => propsById.set(p.id, p));

  const offerCountByAnalysis = new Map<string, number>();
  (offersRes.data ?? []).forEach((o) => {
    if (!o.deal_analysis_id) return;
    offerCountByAnalysis.set(
      o.deal_analysis_id,
      (offerCountByAnalysis.get(o.deal_analysis_id) ?? 0) + 1,
    );
  });

  // Pick most relevant portal per analysis: prefer non-revoked, newest.
  const portalByAnalysis = new Map<string, any>();
  (portalsRes.data ?? []).forEach((p) => {
    const aid = p.deal_analysis_id;
    const existing = portalByAnalysis.get(aid);
    if (!existing) {
      portalByAnalysis.set(aid, p);
      return;
    }
    const existingActive = !existing.revoked_at;
    const newActive = !p.revoked_at;
    if (newActive && !existingActive) portalByAnalysis.set(aid, p);
  });

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return analyses.map<DealCard>((a) => {
    const prop = propsById.get(a.property_id) ?? {};
    const portal = portalByAnalysis.get(a.id);
    return {
      analysisId: a.id,
      name: a.name,
      status: a.status,
      topRecommendation: a.top_recommendation,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      property: {
        id: a.property_id,
        address: prop.address ?? "Untitled property",
        city: prop.city ?? null,
        listingPrice: prop.listing_price ? Number(prop.listing_price) : null,
      },
      offerCount: offerCountByAnalysis.get(a.id) ?? 0,
      portal: portal
        ? {
            id: portal.id,
            token: portal.token,
            title: portal.title,
            createdAt: portal.created_at,
            lastAccessedAt: portal.last_accessed_at,
            revokedAt: portal.revoked_at,
            viewCount: portal.view_count ?? 0,
            portalUrl: `${origin}/portal/${portal.token}`,
            status: statusFor(portal),
          }
        : null,
    };
  });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} wk${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}