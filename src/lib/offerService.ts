import { supabase } from "@/integrations/supabase/client";

// ─── Deal Analysis ───

export async function getOrCreateDemoAnalysis(userId: string) {
  // Check for an existing demo analysis
  const { data: existing } = await supabase
    .from("deal_analyses")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Demo Analysis — 1247 Stone Canyon Rd")
    .maybeSingle();

  if (existing) return existing.id;

  // Get or create demo property
  const { data: prop } = await supabase
    .from("properties")
    .select("id")
    .eq("user_id", userId)
    .eq("address", "1247 Stone Canyon Rd")
    .maybeSingle();

  let propertyId: string;
  if (prop) {
    propertyId = prop.id;
  } else {
    const { data: newProp, error } = await supabase
      .from("properties")
      .insert({
        user_id: userId,
        address: "1247 Stone Canyon Rd",
        city: "Bel Air, CA 90077",
        listing_price: 8750000,
        property_type: "Single Family",
        status: "Active",
        seller_notes: "Seller wants to net as much as possible. Comfortable with 30-day close. Open to short leaseback.",
        seller_goals: ["Maximize net proceeds", "Close within 35 days", "Avoid repair negotiations"],
      })
      .select("id")
      .single();
    if (error) throw error;
    propertyId = newProp.id;
  }

  const { data: analysis, error } = await supabase
    .from("deal_analyses")
    .insert({
      user_id: userId,
      property_id: propertyId,
      name: "Demo Analysis — 1247 Stone Canyon Rd",
      status: "in_progress",
    })
    .select("id")
    .single();

  if (error) throw error;
  return analysis.id;
}

/**
 * Resolve the deal analysis a new offer should attach to.
 * Prefers the user's most recently updated analysis (i.e. the one they
 * just created in NewAnalysis); falls back to the demo analysis.
 */
export async function resolveActiveAnalysisId(userId: string): Promise<string> {
  // Pinned analysis (set when the user opens a deal card) wins.
  let activeId: string | null = null;
  if (typeof window !== "undefined") {
    try {
      activeId = window.localStorage.getItem("offeriq.activeAnalysisId");
    } catch { /* ignore */ }
  }
  if (activeId) {
    const { data: pinned } = await supabase
      .from("deal_analyses")
      .select("id")
      .eq("id", activeId)
      .eq("user_id", userId)
      .maybeSingle();
    if (pinned?.id) return pinned.id;
  }

  const { data: latest } = await supabase
    .from("deal_analyses")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.id) return latest.id;
  return getOrCreateDemoAnalysis(userId);
}

/** Bump updated_at on a deal analysis so it sorts to the top of "latest". */
export async function touchDealAnalysis(dealAnalysisId: string) {
  await supabase
    .from("deal_analyses")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", dealAnalysisId);
}

// ─── Offer Creation ───

export async function createOffer(
  userId: string,
  dealAnalysisId: string,
  buyerName: string,
) {
  const { data, error } = await supabase
    .from("offers")
    .insert({
      user_id: userId,
      deal_analysis_id: dealAnalysisId,
      buyer_name: buyerName,
      labels: [],
      contingencies: [],
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

// ─── Document Upload ───

export async function uploadDocument(
  userId: string,
  offerId: string,
  file: File,
  category: string,
) {
  const filePath = `${userId}/${offerId}/${Date.now()}-${file.name}`;

  // Upload to storage
  const { error: uploadErr } = await supabase.storage
    .from("offer-documents")
    .upload(filePath, file);

  if (uploadErr) throw uploadErr;

  // Create document record
  const { data, error } = await supabase
    .from("documents")
    .insert({
      offer_id: offerId,
      user_id: userId,
      name: file.name,
      category,
      status: "pending",
      confidence: 0,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { documentId: data.id, filePath };
}

// ─── Trigger Extraction ───

export async function triggerExtraction(
  offerId: string,
  offerName: string,
  documents: { id: string; name: string; category: string }[],
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/extract-offer`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      offer_id: offerId,
      offer_name: offerName,
      documents,
    }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Extraction failed");
  return result;
}

// ─── Fetch Extracted Fields ───

export async function fetchExtractedFields(offerId: string) {
  const { data, error } = await supabase
    .from("extracted_offer_fields")
    .select("*")
    .eq("offer_id", offerId)
    .order("version", { ascending: false });

  if (error) throw error;
  return data;
}

// ─── Fetch Offers for a Deal Analysis ───

export async function fetchOffersForAnalysis(dealAnalysisId: string) {
  const { data, error } = await supabase
    .from("offers")
    .select("*, documents(*)")
    .eq("deal_analysis_id", dealAnalysisId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// ─── Fetch latest deal analysis for current user ───

export async function fetchLatestAnalysisForUser(userId: string) {
  // Prefer the user's currently selected ("active") analysis if one is
  // pinned in localStorage by the dashboard / URL. This keeps every page
  // anchored to the same deal as the user navigates the sidebar.
  let activeId: string | null = null;
  if (typeof window !== "undefined") {
    try {
      activeId = window.localStorage.getItem("offeriq.activeAnalysisId");
    } catch { /* ignore */ }
  }

  if (activeId) {
    const { data: pinned, error: pinErr } = await supabase
      .from("deal_analyses")
      .select("*, properties(*)")
      .eq("id", activeId)
      .eq("user_id", userId)
      .maybeSingle();
    if (pinErr) throw pinErr;
    if (pinned) return pinned;
    // Stored ID is stale — fall through to "latest by updated_at".
  }

  const { data, error } = await supabase
    .from("deal_analyses")
    .select("*, properties(*)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Fetch offers + their latest extracted fields for an analysis ───

export interface OfferWithExtraction {
  offer: any;
  documents: any[];
  fields: Record<
    string,
    {
      value: any;
      confidence: number;
      evidence: string | null;
      sourceDocumentName: string | null;
    }
  >;
  missingItems: string[];
  notableRisks: string[];
  notableStrengths: string[];
}

export async function fetchOffersWithExtraction(
  dealAnalysisId: string,
): Promise<OfferWithExtraction[]> {
  const { data: offers, error } = await supabase
    .from("offers")
    .select("*, documents(*)")
    .eq("deal_analysis_id", dealAnalysisId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!offers || offers.length === 0) return [];

  const offerIds = offers.map((o: any) => o.id);
  const { data: extracted } = await supabase
    .from("extracted_offer_fields")
    .select("*")
    .in("offer_id", offerIds);

  // Group latest version per offer, then per field
  const latestByOffer: Record<string, Record<string, any>> = {};
  const versionByOffer: Record<string, number> = {};
  for (const row of extracted ?? []) {
    const v = row.version ?? 1;
    if ((versionByOffer[row.offer_id] ?? 0) < v) versionByOffer[row.offer_id] = v;
  }
  for (const row of extracted ?? []) {
    if ((row.version ?? 1) !== versionByOffer[row.offer_id]) continue;
    if (!latestByOffer[row.offer_id]) latestByOffer[row.offer_id] = {};
    latestByOffer[row.offer_id][row.field_name] = {
      value: row.field_value,
      confidence: Number(row.confidence ?? 0),
      evidence: row.evidence,
      sourceDocumentName: (row as any).source_document_name ?? null,
    };
  }

  return offers.map((o: any) => {
    const fields = latestByOffer[o.id] ?? {};
    return {
      offer: o,
      documents: o.documents ?? [],
      fields,
      missingItems: (fields.missing_items?.value as string[]) ?? [],
      notableRisks: (fields.notable_risks?.value as string[]) ?? [],
      notableStrengths: (fields.notable_strengths?.value as string[]) ?? [],
    };
  });
}

// ─── Persist computed scores to risk_scores ───

export interface RiskScoreInput {
  offerStrength: number;
  closeProbability: number;
  financialConfidence: number;
  contingencyRisk: number;
  timingRisk: number;
  packageCompleteness: number;
  factorDetails?: any;
}

/** Insert a new versioned risk_scores row for an offer. */
export async function saveRiskScore(offerId: string, input: RiskScoreInput) {
  const { data: latest } = await supabase
    .from("risk_scores")
    .select("version")
    .eq("offer_id", offerId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  const { error } = await supabase.from("risk_scores").insert({
    offer_id: offerId,
    version: nextVersion,
    offer_strength: input.offerStrength,
    close_probability: input.closeProbability,
    financial_confidence: input.financialConfidence,
    contingency_risk: input.contingencyRisk,
    timing_risk: input.timingRisk,
    package_completeness: input.packageCompleteness,
    factor_details: input.factorDetails ?? null,
  });
  if (error) throw error;
  return nextVersion;
}

/** Fetch the latest risk_scores row per offer for an analysis. */
export async function fetchLatestRiskScores(offerIds: string[]) {
  if (offerIds.length === 0) return {} as Record<string, any>;
  const { data, error } = await supabase
    .from("risk_scores")
    .select("*")
    .in("offer_id", offerIds)
    .order("version", { ascending: false });
  if (error) throw error;
  const byOffer: Record<string, any> = {};
  for (const row of data ?? []) {
    if (!byOffer[row.offer_id]) byOffer[row.offer_id] = row;
  }
  return byOffer;
}

// ─── Seller Priorities ───

export interface SellerPriorityWeights {
  price_weight: number;
  certainty_weight: number;
  contingencies_weight: number;
  speed_weight: number;
  leaseback_weight: number;
  repair_weight: number;
  financial_weight: number;
}

export async function fetchSellerPriorities(
  userId: string,
  dealAnalysisId: string,
) {
  const { data, error } = await supabase
    .from("seller_priorities")
    .select("*")
    .eq("user_id", userId)
    .eq("deal_analysis_id", dealAnalysisId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertSellerPriorities(
  userId: string,
  dealAnalysisId: string,
  weights: SellerPriorityWeights,
) {
  // Try update first
  const { data: existing } = await supabase
    .from("seller_priorities")
    .select("id")
    .eq("user_id", userId)
    .eq("deal_analysis_id", dealAnalysisId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("seller_priorities")
      .update({ ...weights, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("seller_priorities")
    .insert({
      user_id: userId,
      deal_analysis_id: dealAnalysisId,
      ...weights,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// ─── Leverage Suggestions ───

import type { LeverageSuggestion } from "@/lib/leverageEngine";

export async function saveLeverageSuggestions(
  dealAnalysisId: string,
  payload: {
    suggestions: LeverageSuggestion[];
    easiest_wins: LeverageSuggestion[];
    highest_impact_terms: LeverageSuggestion[];
    notes?: string;
  },
) {
  const { data: latest } = await supabase
    .from("leverage_suggestions")
    .select("version")
    .eq("deal_analysis_id", dealAnalysisId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  const { error } = await supabase.from("leverage_suggestions").insert({
    deal_analysis_id: dealAnalysisId,
    version: nextVersion,
    suggestions: payload.suggestions as any,
    easiest_wins: payload.easiest_wins as any,
    highest_impact_terms: payload.highest_impact_terms as any,
    notes: payload.notes ?? null,
  });
  if (error) throw error;
  return nextVersion;
}

export async function fetchLatestLeverageSuggestions(dealAnalysisId: string) {
  const { data, error } = await supabase
    .from("leverage_suggestions")
    .select("*")
    .eq("deal_analysis_id", dealAnalysisId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Counter Strategies ───

import type { CounterStrategy } from "@/lib/counterStrategyEngine";

export async function saveCounterStrategies(
  dealAnalysisId: string,
  strategies: CounterStrategy[],
) {
  const { data: latest } = await supabase
    .from("counter_strategies")
    .select("version")
    .eq("deal_analysis_id", dealAnalysisId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  const rows = strategies.map((s) => ({
    deal_analysis_id: dealAnalysisId,
    version: nextVersion,
    strategy_type: s.strategy_type,
    target_buyer: s.target_buyer,
    counter_price: s.counter_price,
    acceptance_likelihood: s.acceptance_likelihood,
    rationale: s.rationale,
    risk: s.risk,
    terms: s as any,
  }));

  const { error } = await supabase.from("counter_strategies").insert(rows);
  if (error) throw error;
  return nextVersion;
}

export async function fetchLatestCounterStrategies(dealAnalysisId: string) {
  const { data, error } = await supabase
    .from("counter_strategies")
    .select("*")
    .eq("deal_analysis_id", dealAnalysisId)
    .order("version", { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const latestVersion = data[0].version;
  return data.filter((r: any) => r.version === latestVersion);
}

// ─── Field Corrections (manual review of AI extraction) ───

export interface FieldCorrection {
  field_name: string;
  field_value: any;
  // The original confidence + evidence + source we want to preserve
  // so the audit trail stays intact even after a human edit.
  prior_confidence: number;
  prior_evidence: string | null;
  prior_source_document_name: string | null;
  prior_source_document_id: string | null;
  // True if the user changed this field; false means we just carry the
  // prior extraction forward into the new version unchanged.
  edited: boolean;
}

/**
 * Persist manual field corrections from the review dialog.
 * Creates a NEW version in extracted_offer_fields (insert-only table)
 * and re-rolls the canonical offer columns so the rest of the app sees
 * the corrected values.
 */
export async function saveFieldCorrections(
  offerId: string,
  offerName: string,
  corrections: FieldCorrection[],
) {
  // Next version
  const { data: latest } = await supabase
    .from("extracted_offer_fields")
    .select("version")
    .eq("offer_id", offerId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latest?.version ?? 0) + 1;

  // Carry forward summary fields (missing_items / notable_risks / notable_strengths)
  // from the previous version so the comparison view doesn't lose them.
  const priorVersion = latest?.version ?? null;
  let summaryRows: any[] = [];
  if (priorVersion !== null) {
    const { data: prior } = await supabase
      .from("extracted_offer_fields")
      .select("*")
      .eq("offer_id", offerId)
      .eq("version", priorVersion)
      .in("field_name", ["missing_items", "notable_risks", "notable_strengths"]);
    summaryRows = (prior ?? []).map((r: any) => ({
      offer_id: offerId,
      field_name: r.field_name,
      field_value: r.field_value,
      confidence: r.confidence,
      evidence: r.evidence,
      source_document_id: r.source_document_id,
      source_document_name: r.source_document_name,
      version: nextVersion,
    }));
  }

  const correctionRows = corrections.map((c) => ({
    offer_id: offerId,
    field_name: c.field_name,
    field_value: c.field_value,
    // If the user edited the field, lock confidence at 1.0 (human verified)
    // and tag evidence so we can render a "Corrected by agent" pill.
    confidence: c.edited ? 1 : c.prior_confidence,
    evidence: c.edited
      ? `Corrected by agent. Original AI evidence: ${c.prior_evidence ?? "(none)"}`
      : c.prior_evidence,
    source_document_id: c.prior_source_document_id,
    source_document_name: c.edited
      ? `${c.prior_source_document_name ?? "Manual entry"} (corrected)`
      : c.prior_source_document_name,
    version: nextVersion,
  }));

  const { error: insertErr } = await supabase
    .from("extracted_offer_fields")
    .insert([...correctionRows, ...summaryRows]);
  if (insertErr) throw insertErr;

  // Re-roll the canonical offer columns from the corrected map.
  const m: Record<string, any> = {};
  for (const c of correctionRows) {
    if (c.field_value !== null && c.field_value !== undefined) m[c.field_name] = c.field_value;
  }

  const contingencies: string[] = [];
  if (m.inspection_contingency_present) {
    contingencies.push(
      m.inspection_contingency_days
        ? `Inspection (${m.inspection_contingency_days} days)`
        : "Inspection",
    );
  }
  if (m.appraisal_contingency_present) contingencies.push("Appraisal");
  if (m.loan_contingency_present) contingencies.push("Loan");

  const expected = [
    "offer_price",
    "financing_type",
    "earnest_money_deposit",
    "close_of_escrow_days",
    "down_payment_percent",
  ];
  const completeness = Math.round(
    (expected.filter((k) => m[k] !== undefined && m[k] !== null).length / expected.length) * 100,
  );

  const offerUpdate: Record<string, any> = {
    buyer_name: m.buyer_name ?? offerName,
    agent_name: m.agent_name ?? null,
    agent_brokerage: m.agent_brokerage ?? null,
    offer_price: typeof m.offer_price === "number" ? m.offer_price : null,
    financing_type: m.financing_type ?? null,
    down_payment: m.down_payment_amount ?? null,
    down_payment_percent: m.down_payment_percent ?? null,
    earnest_money: m.earnest_money_deposit ?? null,
    close_days: m.close_of_escrow_days ?? null,
    close_timeline: m.close_of_escrow_days ? `${m.close_of_escrow_days} days` : null,
    inspection_period: m.inspection_contingency_days
      ? `${m.inspection_contingency_days} days`
      : null,
    leaseback_request: m.leaseback_requested
      ? m.leaseback_days
        ? `${m.leaseback_days}-day leaseback`
        : "Requested"
      : "None",
    concessions: m.concessions_requested ?? "None",
    proof_of_funds: !!m.proof_of_funds_present,
    pre_approval: !!m.preapproval_present,
    contingencies,
    completeness,
    special_notes: m.special_notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error: updateErr } = await supabase
    .from("offers")
    .update(offerUpdate)
    .eq("id", offerId);
  if (updateErr) throw updateErr;

  return nextVersion;
}