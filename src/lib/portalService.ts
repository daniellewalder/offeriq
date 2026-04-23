import { supabase } from "@/integrations/supabase/client";
import { adaptOffer } from "@/lib/offerAdapter";
import { computeScores, type ScoredOffer } from "@/lib/scoringEngine";
import { generateLeverage } from "@/lib/leverageEngine";
import { generateCounterStrategies } from "@/lib/counterStrategyEngine";
import {
  buildSellerPresentation,
  type SellerPresentation,
} from "@/lib/sellerReportBuilder";
import type { OfferWithExtraction, SellerPriorityWeights } from "@/lib/offerService";
import type { Offer } from "@/data/sampleData";

/* ── Token / code helpers ── */

function randomToken(len = 22): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alpha =
    "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(bytes, (b) => alpha[b % alpha.length]).join("");
}

function randomCode(): string {
  // 6-char readable code, no ambiguous chars.
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alpha[b % alpha.length]).join("");
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface CreatePortalArgs {
  user_id: string;
  deal_analysis_id: string;
  title: string;
  /** Optional fixed code; if omitted, generated. */
  code?: string;
  /** ISO date — optional expiration. */
  expires_at?: string | null;
}

export interface CreatedPortal {
  id: string;
  token: string;
  code: string;
  portal_url: string;
  pdf_url: string;
  presentation_url: string;
}

export async function createSharedPortal(
  args: CreatePortalArgs,
): Promise<CreatedPortal> {
  const token = randomToken();
  const code = (args.code ?? randomCode()).trim();
  const access_code_hash = await sha256(code.toLowerCase());

  const { data, error } = await supabase
    .from("shared_portals")
    .insert({
      user_id: args.user_id,
      deal_analysis_id: args.deal_analysis_id,
      title: args.title,
      token,
      access_code_hash,
      expires_at: args.expires_at ?? null,
    })
    .select("id, token")
    .single();
  if (error) throw error;

  const origin = window.location.origin;
  return {
    id: data.id,
    token: data.token,
    code,
    portal_url: `${origin}/portal/${data.token}`,
    pdf_url: `${origin}/seller-report/${data.token}`,
    presentation_url: `${origin}/portal/${data.token}/present`,
  };
}

export async function listPortalsForAnalysis(
  user_id: string,
  deal_analysis_id: string,
) {
  const { data, error } = await supabase
    .from("shared_portals")
    .select("*")
    .eq("user_id", user_id)
    .eq("deal_analysis_id", deal_analysis_id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function revokePortal(id: string) {
  const { error } = await supabase
    .from("shared_portals")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/* ── Public access (calls edge function) ── */

export interface PortalPayload {
  presentation: SellerPresentation;
  portal: { id: string; title: string; deal_analysis_id: string };
}

export async function fetchPortalMeta(token: string) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/portal-access`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load portal");
  return json as { requires_code: boolean; title: string };
}

export async function unlockPortal(
  token: string,
  code: string,
): Promise<PortalPayload> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/portal-access`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, code }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Incorrect access code");
  return hydratePresentation(json);
}

/* ── Hydrate raw payload into SellerPresentation ── */

function hydrateScored(row: any): ScoredOffer {
  const f = row.factor_details ?? {};
  const wrap = (score: number, key: string) => ({
    score: Number(score ?? 50),
    factors: f?.[key]?.factors ?? [],
    summary: f?.[key]?.summary ?? "",
  });
  return {
    offerStrength: wrap(row.offer_strength, "offerStrength"),
    closeProbability: wrap(row.close_probability, "closeProbability"),
    financialConfidence: wrap(row.financial_confidence, "financialConfidence"),
    contingencyRisk: wrap(row.contingency_risk, "contingencyRisk"),
    timingRisk: wrap(row.timing_risk, "timingRisk"),
    packageCompleteness: wrap(row.package_completeness, "packageCompleteness"),
  };
}

function hydratePresentation(json: any): PortalPayload {
  const analysis = json.analysis ?? {};
  const property = analysis.properties ?? {};
  const listingPrice = Number(property.listing_price ?? 0);

  // Group extracted fields per offer at latest version.
  const extracted = json.extracted ?? [];
  const versionByOffer: Record<string, number> = {};
  for (const r of extracted) {
    const v = r.version ?? 1;
    if ((versionByOffer[r.offer_id] ?? 0) < v) versionByOffer[r.offer_id] = v;
  }
  const fieldsByOffer: Record<string, Record<string, any>> = {};
  for (const r of extracted) {
    if ((r.version ?? 1) !== versionByOffer[r.offer_id]) continue;
    if (!fieldsByOffer[r.offer_id]) fieldsByOffer[r.offer_id] = {};
    fieldsByOffer[r.offer_id][r.field_name] = {
      value: r.field_value,
      confidence: Number(r.confidence ?? 0),
      evidence: r.evidence,
    };
  }

  const offers: Offer[] = (json.offers ?? []).map((o: any) => {
    const row: OfferWithExtraction = {
      offer: o,
      documents: o.documents ?? [],
      fields: fieldsByOffer[o.id] ?? {},
      missingItems: (fieldsByOffer[o.id]?.missing_items?.value as string[]) ?? [],
      notableRisks: (fieldsByOffer[o.id]?.notable_risks?.value as string[]) ?? [],
      notableStrengths:
        (fieldsByOffer[o.id]?.notable_strengths?.value as string[]) ?? [],
    };
    return adaptOffer(row, listingPrice);
  });

  // Latest scores per offer
  const latestVersion: Record<string, number> = {};
  for (const s of json.scores ?? []) {
    const v = s.version ?? 1;
    if ((latestVersion[s.offer_id] ?? 0) < v) latestVersion[s.offer_id] = v;
  }
  const scoresMap: Record<string, ScoredOffer | undefined> = {};
  for (const s of json.scores ?? []) {
    if ((s.version ?? 1) === latestVersion[s.offer_id])
      scoresMap[s.offer_id] = hydrateScored(s);
  }
  for (const o of offers) {
    if (!scoresMap[o.id]) scoresMap[o.id] = computeScores(o, listingPrice);
  }

  const priorities: SellerPriorityWeights | null = json.priorities
    ? {
        price_weight: json.priorities.price_weight ?? 80,
        certainty_weight: json.priorities.certainty_weight ?? 70,
        contingencies_weight: json.priorities.contingencies_weight ?? 60,
        speed_weight: json.priorities.speed_weight ?? 50,
        leaseback_weight: json.priorities.leaseback_weight ?? 30,
        repair_weight: json.priorities.repair_weight ?? 40,
        financial_weight: json.priorities.financial_weight ?? 65,
      }
    : null;

  const leverage =
    (json.leverage?.suggestions as any[]) ??
    generateLeverage(offers, {
      listingPrice,
      goals: (property.seller_goals as string[]) ?? [],
    }).suggestions;

  let strategies = (json.strategies ?? [])
    .map((row: any) => row.terms)
    .filter(Boolean);
  if (strategies.length === 0) {
    strategies = generateCounterStrategies({
      offers,
      scores: scoresMap,
      leverage,
      priorities,
      listingPrice,
      sellerGoals: (property.seller_goals as string[]) ?? [],
    }).strategies;
  }

  const presentation = buildSellerPresentation({
    property: {
      address: property.address ?? "Property",
      city: property.city,
      listing_price: listingPrice,
    },
    offers,
    scores: scoresMap,
    leverage,
    strategies,
    priorities,
    sellerGoals: (property.seller_goals as string[]) ?? [],
  });

  return {
    presentation,
    portal: json.portal,
  };
}

/* ── Token-free local build (used by demo / preview) ── */

export { hydratePresentation };