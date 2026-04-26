import type { Offer, FieldEvidence } from "@/data/sampleData";

/**
 * Negotiation Leverage rules engine.
 *
 * Produces structured, per-offer suggestions designed to be schema-compatible
 * with future AI-generated output. Each suggestion identifies a term where
 * a small ask creates outsized seller value with relatively low buyer friction.
 *
 * Schema (LeverageSuggestion) is intentionally flat + JSON-serializable so it
 * can be persisted directly into `leverage_suggestions.suggestions` (jsonb)
 * and later replaced/augmented by an LLM-backed generator that returns the
 * same shape.
 */

export type LeverageTag =
  | "High Seller Impact"
  | "Low Buyer Friction"
  | "Strong Counter Candidate"
  | "Likely Acceptance Booster";

export type LeverageCategory =
  | "leaseback"
  | "timing"
  | "deposit"
  | "contingency"
  | "appraisal"
  | "repair"
  | "concession"
  | "financing";

export interface LeverageSuggestion {
  /** Stable id for de-dup / cross-render keys. */
  id: string;
  offer_id: string;
  buyer_name: string;
  category: LeverageCategory;
  /** Concrete proposal — what to ask for in the counter. */
  term: string;
  /** One-sentence headline for skim-reading. */
  headline: string;
  /** Concise reasoning the agent can repeat to the seller / buyer. */
  reasoning: string;
  /** What the seller gets out of the trade. */
  seller_gets: string;
  /** What the buyer gives up — usually low or symbolic. */
  buyer_gives: string;
  /** Seller value on a 0–100 scale. */
  seller_impact_score: number;
  /** Buyer friction on a 0–100 scale (lower is better). */
  buyer_friction_score: number;
  /** Zero or more semantic tags. */
  tags: LeverageTag[];
  /** Marker so a UI/agent can tell rules-based vs AI output apart. */
  source: "rules" | "ai";
  /** Document evidence backing the underlying risk factor (if any). */
  evidence?: {
    fieldKey: string;
    quote: string | null;
    documentName: string | null;
    confidence: number;
  };
  /** Ready-to-paste counter-move language the agent can drop into a counter. */
  counter_move?: {
    /** Short label, e.g. "Counter language". */
    label: string;
    /** Verbatim addendum / counter-offer clause. */
    text: string;
  };
}

interface SellerContext {
  goals?: string[];
  notes?: string;
  listingPrice: number;
}

const tagsFor = (impact: number, friction: number): LeverageTag[] => {
  const tags: LeverageTag[] = [];
  if (impact >= 70) tags.push("High Seller Impact");
  if (friction <= 25) tags.push("Low Buyer Friction");
  if (impact >= 60 && friction <= 40) tags.push("Strong Counter Candidate");
  if (friction <= 20 && impact >= 50) tags.push("Likely Acceptance Booster");
  return tags;
};

const parseDays = (s: string | number | undefined): number | null => {
  if (s == null) return null;
  if (typeof s === "number") return s;
  const m = String(s).match(/(\d+)/);
  return m ? Number(m[1]) : null;
};

/** Map a leverage category to the extracted-field key whose evidence backs it. */
const evidenceKeyFor: Record<LeverageCategory, string> = {
  leaseback: "leaseback_request",
  timing: "close_timeline",
  deposit: "earnest_money",
  contingency: "inspection_period",
  appraisal: "appraisal_terms",
  repair: "contingencies",
  concession: "concessions",
  financing: "financing_type",
};

function evidenceFor(offer: Offer, category: LeverageCategory) {
  const key = evidenceKeyFor[category];
  const e: FieldEvidence | undefined = offer.evidence?.[key];
  if (!e) return undefined;
  return {
    fieldKey: key,
    quote: e.quote,
    documentName: e.documentName,
    confidence: e.confidence,
  };
}

/**
 * Generate suggestions for a single offer. Pure function — no side effects,
 * no I/O — so it's trivially testable and swappable with an AI generator.
 */
export function generateLeverageForOffer(
  offer: Offer,
  ctx: SellerContext,
): LeverageSuggestion[] {
  const out: LeverageSuggestion[] = [];
  const push = (s: Omit<LeverageSuggestion, "id" | "offer_id" | "buyer_name" | "tags" | "source" | "evidence">) => {
    const tags = tagsFor(s.seller_impact_score, s.buyer_friction_score);
    out.push({
      id: `${offer.id}-${s.category}-${out.length}`,
      offer_id: offer.id,
      buyer_name: offer.buyerName,
      tags,
      source: "rules",
      evidence: evidenceFor(offer, s.category),
      ...s,
    });
  };

  const list = ctx.listingPrice || 1;
  const priceRatio = offer.offerPrice / list;
  const inspectionDays = parseDays(offer.inspectionPeriod) ?? 0;
  const emdPct = offer.earnestMoney / Math.max(offer.offerPrice, 1);
  const isCash = (offer.financingType || "").toLowerCase().includes("cash");
  const leasebackPrefersSeller = (ctx.goals ?? []).some((g) =>
    g.toLowerCase().includes("leaseback"),
  );

  // ── Leaseback: short, free leaseback in exchange for price firmness ──
  const leaseback = (offer.leasebackRequest || "None").toLowerCase();
  if (leaseback === "none" || leaseback.includes("flex")) {
    const impact = leasebackPrefersSeller ? 85 : 70;
    push({
      category: "leaseback",
      term: "Request 7–14 day rent-free leaseback",
      headline:
        "A short post-close leaseback costs the buyer almost nothing but unlocks real pricing leverage.",
      reasoning:
        "At this price point, two weeks of carrying cost is a rounding error for the buyer. For the seller, it removes move-out pressure and creates room to hold firm on price or push back on concessions. Buyers who are flexible on timing rarely refuse a short leaseback.",
      seller_gets: "Move-out flexibility + leverage to hold on price",
      buyer_gives: "7–14 days of post-close occupancy (minimal cost)",
      seller_impact_score: impact,
      buyer_friction_score: 15,
    });
  }

  // ── Inspection contingency: shorten if long ──
  if (inspectionDays >= 10) {
    const impact = inspectionDays >= 15 ? 85 : 70;
    push({
      category: "contingency",
      term: `Tighten inspection window to ${Math.max(5, Math.min(7, inspectionDays - 5))} days`,
      headline:
        `${inspectionDays}-day inspection is wide open for renegotiation — shorter signals commitment.`,
      reasoning:
        "Long inspection windows are where well-structured deals leak value. A 5–7 day window is standard for serious luxury offers and dramatically shrinks the surface area for repair-credit re-trades. Buyers who push back hard on a tighter window often plan to renegotiate regardless.",
      seller_gets: "Lower renegotiation risk + faster path to firm contract",
      buyer_gives: "Faster inspection turnaround (still standard for the segment)",
      seller_impact_score: impact,
      buyer_friction_score: 30,
    });
  }

  // ── Earnest money: push higher if light ──
  if (emdPct < 0.025 && !isCash) {
    const targetPct = 3;
    const target = Math.round((offer.offerPrice * targetPct) / 100 / 1000) * 1000;
    push({
      category: "deposit",
      term: `Increase earnest money to ~$${(target / 1000).toFixed(0)}K (${targetPct}%)`,
      headline:
        "A larger refundable deposit is a pure commitment signal — qualified buyers have no real reason to refuse.",
      reasoning:
        `Current EMD is ~${(emdPct * 100).toFixed(1)}% of the price, which doesn't make walking away materially expensive. Bumping to ${targetPct}% costs a well-qualified buyer nothing — the funds sit in escrow and return at close — but it makes a default genuinely painful. It also filters out buyers who can't put real money behind their offer.`,
      seller_gets: "Stronger commitment, costly buyer exit",
      buyer_gives: "Larger refundable deposit held in escrow",
      seller_impact_score: 75,
      buyer_friction_score: 15,
    });
  }

  // ── Appraisal gap coverage on financed offers ──
  const appraisal = (offer.appraisalTerms || "").toLowerCase();
  const hasAppraisalContingency = (offer.contingencies ?? []).some((c) =>
    c.toLowerCase().includes("appraisal"),
  );
  if (!isCash && (hasAppraisalContingency || appraisal.includes("standard"))) {
    push({
      category: "appraisal",
      term: "Require $150K–$200K appraisal gap coverage",
      headline:
        "Low appraisals are the #1 deal-killer in luxury — gap coverage protects the close.",
      reasoning:
        "Comparable sales data is thin at this price point, so appraisals routinely come in under contract. Without gap coverage, a low appraisal forces a renegotiation or kills the deal outright. A buyer unwilling to commit to even a partial gap is signaling their financial ceiling.",
      seller_gets: "Insulation against the most common financed-deal failure",
      buyer_gives: "Commitment to bridge appraisal shortfall up to a cap",
      seller_impact_score: 80,
      buyer_friction_score: 45,
    });
  }

  // ── Repair: convert to as-is + small credit ──
  const hasRepairContingency = (offer.contingencies ?? []).some((c) =>
    c.toLowerCase().includes("repair") || c.toLowerCase().includes("inspection"),
  );
  if (hasRepairContingency) {
    push({
      category: "repair",
      term: "Counter as sold as-is with a fixed $10K–$20K credit",
      headline:
        "Replace open-ended repair asks with a known credit — predictable for you, concrete for them.",
      reasoning:
        "Post-inspection repair requests are where deals quietly unwind. A defined credit gives the buyer something tangible while eliminating the risk that a $12K finding becomes a $40K ask two weeks before close. You trade a known, capped cost for certainty on the rest of the contract.",
      seller_gets: "No surprise repair demands, predictable net",
      buyer_gives: "Accepts property condition for a defined credit",
      seller_impact_score: 65,
      buyer_friction_score: 30,
    });
  }

  // ── Concessions: reframe ──
  const concessions = (offer.concessions || "None").toLowerCase();
  if (concessions !== "none" && !concessions.includes("no")) {
    push({
      category: "concession",
      term: "Reject concession ask, offer smaller closing-cost credit",
      headline:
        "Buyer's concession ask is an anchor, not a number — counter with a smaller closing credit.",
      reasoning:
        "Concession requests are typically inflated opening positions. Countering with a smaller closing-cost credit acknowledges the ask without accepting the frame, and prevents a precedent where every credit request balloons during the inspection period.",
      seller_gets: "Materially lower concession dollars",
      buyer_gives: "Accepts a smaller closing-cost credit in lieu of the original ask",
      seller_impact_score: 60,
      buyer_friction_score: 25,
    });
  }

  // ── Timing: give in on close date when buyer wants speed/delay ──
  if (offer.closeDays && (offer.closeDays <= 25 || offer.closeDays >= 45)) {
    push({
      category: "timing",
      term: "Grant preferred close date in exchange for term firmness",
      headline:
        "Buyers overvalue timeline certainty — give it to them, then hold on price and contingencies.",
      reasoning:
        `Buyer is pushing for a ${offer.closeDays}-day close. Granting it costs you nothing financially but creates goodwill you can convert into firmness on price, contingencies, or the leaseback. It feels like a major concession to them while preserving everything that affects your net.`,
      seller_gets: "Leverage to hold on price and contingency terms",
      buyer_gives: "Nothing — they get their preferred timeline",
      seller_impact_score: 60,
      buyer_friction_score: 5,
    });
  }

  // ── Financing: ask for proof of funds / pre-approval upgrade ──
  if (!isCash && (!offer.proofOfFunds || !offer.preApproval)) {
    const missing: string[] = [];
    if (!offer.proofOfFunds) missing.push("proof of funds");
    if (!offer.preApproval) missing.push("written pre-approval");
    push({
      category: "financing",
      term: `Require ${missing.join(" and ")} before counter acceptance`,
      headline:
        "Verifying the buyer's financial position is the cheapest insurance you can ask for.",
      reasoning:
        "These documents cost the buyer nothing if they exist — and reveal a real problem if they don't. Making them a precondition of countering filters non-serious buyers and protects against late-stage financing fall-through.",
      seller_gets: "Verified financial capacity, fewer late surprises",
      buyer_gives: "Standard documentation already in their file",
      seller_impact_score: 70,
      buyer_friction_score: 10,
    });
  }

  // ── Premium price already at/above asking → strengthen Acceptance Booster posture ──
  if (priceRatio >= 1.0 && out.length > 0) {
    // No new card — the price strength gets reflected in seller_gets framing above.
  }

  return out;
}

export interface LeverageSummary {
  suggestions: LeverageSuggestion[];
  easiest_wins: LeverageSuggestion[];
  highest_impact_terms: LeverageSuggestion[];
}

/**
 * Generate suggestions across many offers and surface the highest-leverage
 * picks across the whole package. Output shape mirrors `leverage_suggestions`
 * table columns so it can be persisted with no transformation.
 */
export function generateLeverage(
  offers: Offer[],
  ctx: SellerContext,
): LeverageSummary {
  const all = offers.flatMap((o) => generateLeverageForOffer(o, ctx));

  const easiest_wins = [...all]
    .sort((a, b) => a.buyer_friction_score - b.buyer_friction_score || b.seller_impact_score - a.seller_impact_score)
    .slice(0, 3);

  const highest_impact_terms = [...all]
    .sort((a, b) => b.seller_impact_score - a.seller_impact_score)
    .slice(0, 3);

  return { suggestions: all, easiest_wins, highest_impact_terms };
}
