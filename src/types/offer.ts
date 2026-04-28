// ─── Offer Extraction Types ───────────────────────────────────────────────────
// These types mirror the JSON schema extracted by the Claude Edge Function.
// All nullable fields represent data not found in the source document.

export type FinanceType = "conventional" | "fha" | "va" | "cash" | "other";
export type DocumentType =
  | "rpa"
  | "counter_offer"
  | "addendum"
  | "pre_approval"
  | "proof_of_funds"
  | "disclosure"
  | "other";
export type ConfidenceLevel = "high" | "medium" | "low";
export type PaidBy = "buyer" | "seller" | "split";

export interface OfferBuyer {
  name: string | null;
  agent_name: string | null;
  agent_brokerage: string | null;
  is_represented: boolean;
}

export interface OfferProperty {
  address: string | null;
  apn: string | null;
}

export interface OfferPrice {
  offer_price: number | null;
  initial_deposit: number | null;
  initial_deposit_days: number | null;
  increased_deposit: number | null;
  increased_deposit_days: number | null;
  down_payment: number | null;
  loan_amount: number | null;
  finance_type: FinanceType | null;
}

export interface OfferFinancing {
  is_cash_offer: boolean;
  loan_type: string | null;
  loan_term_years: number | null;
  interest_rate_max: number | null;
  loan_contingency: boolean;
  loan_contingency_days: number | null;
  pre_approval_attached: boolean;
  proof_of_funds_attached: boolean;
}

export interface OfferContingencies {
  inspection: boolean;
  inspection_days: number | null;
  appraisal: boolean;
  appraisal_days: number | null;
  appraisal_waived: boolean;
  loan: boolean;
  loan_days: number | null;
  sale_of_property: boolean;
  sale_of_property_address: string | null;
  investigation: boolean;
  investigation_days: number | null;
  title: boolean;
  title_days: number | null;
  other_contingencies: string[];
}

export interface OfferTimeline {
  offer_date: string | null;
  offer_expiration: string | null;
  close_of_escrow_days: number | null;
  close_of_escrow_date: string | null;
  possession_days_after_coe: number | null;
}

export interface OfferCreditsAndCosts {
  seller_credits: number | null;
  seller_credit_description: string | null;
  buyer_pays_transfer_tax: boolean | null;
  home_warranty_amount: number | null;
  home_warranty_paid_by: PaidBy | null;
  escrow_company_preference: string | null;
  title_company_preference: string | null;
}

export interface OfferTerms {
  as_is: boolean;
  leaseback_requested: boolean;
  leaseback_days: number | null;
  leaseback_rent_per_day: number | null;
  personal_property_included: string[];
  personal_property_excluded: string[];
  inclusions: string[];
  exclusions: string[];
  additional_terms: string | null;
}

export interface OfferRiskFlags {
  has_escalation_clause: boolean;
  escalation_cap: number | null;
  escalation_increment: number | null;
  contingencies_waived_count: number;
  buyer_has_financing_risk: boolean;
  offer_notes: string | null;
}

export interface DocumentMeta {
  document_type: DocumentType;
  confidence: ConfidenceLevel;
  missing_fields: string[];
  extraction_notes: string | null;
}

/** The full structured offer extracted from a PDF */
export interface ExtractedOffer {
  buyer: OfferBuyer;
  property: OfferProperty;
  price: OfferPrice;
  financing: OfferFinancing;
  contingencies: OfferContingencies;
  timeline: OfferTimeline;
  credits_and_costs: OfferCreditsAndCosts;
  terms: OfferTerms;
  risk_flags: OfferRiskFlags;
  document_meta: DocumentMeta;
}

/** A processed offer file — the extracted data plus metadata about the upload */
export interface OfferFile {
  id: string;
  file_name: string;
  file_size: number;
  status: "pending" | "extracting" | "complete" | "error";
  extracted: ExtractedOffer | null;
  error?: string;
  uploaded_at: string;
}

/** The result returned by the Edge Function */
export interface ExtractionResult {
  success: boolean;
  file_name: string;
  extracted: ExtractedOffer;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: string;
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

/** Compute a simple deal-certainty score (0–100) from extracted offer data */
export function computeDealCertaintyScore(offer: ExtractedOffer): number {
  let score = 100;

  // Cash offer = highest certainty
  if (offer.financing.is_cash_offer) {
    score = Math.min(score, 95);
  } else {
    // Penalize financing risk
    if (offer.risk_flags.buyer_has_financing_risk) score -= 20;
    if (!offer.financing.pre_approval_attached) score -= 10;
    if (!offer.financing.loan_contingency) score -= 5; // waived = slight risk
  }

  // Contingency penalties
  if (offer.contingencies.inspection) score -= 5;
  if (offer.contingencies.appraisal && !offer.contingencies.appraisal_waived) score -= 8;
  if (offer.contingencies.sale_of_property) score -= 15;

  // Escalation clause = uncertainty
  if (offer.risk_flags.has_escalation_clause) score -= 3;

  return Math.max(0, Math.min(100, score));
}

/** Compute a risk level label from the deal certainty score */
export function getRiskLevel(score: number): "low" | "medium" | "high" {
  if (score >= 80) return "low";
  if (score >= 55) return "medium";
  return "high";
}

/** Format a dollar amount for display */
export function formatDollars(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
