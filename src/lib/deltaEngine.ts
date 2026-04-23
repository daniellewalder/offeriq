import type { Offer } from "@/data/sampleData";
import type { ScoredOffer } from "@/lib/scoringEngine";
import type { SellerPriorityWeights } from "@/lib/offerService";

/**
 * Negotiation Delta engine.
 *
 * For each offer, compute the gap vs. the seller's desired outcome across
 * six negotiation dimensions and label the move difficulty (Easy / Moderate /
 * Hard / Locked). Output is JSON-serializable so an AI scorer can replace
 * `computeDeltas` later without UI changes.
 */

export type DeltaDimension =
  | "price"
  | "timing"
  | "contingencies"
  | "concessions"
  | "leaseback"
  | "financing_certainty";

export type Movability = "easy" | "moderate" | "hard" | "locked";
export type Sentiment = "exceeds" | "meets" | "gap" | "large_gap";

export interface DimensionDelta {
  dimension: DeltaDimension;
  label: string;
  desired: string;
  actual: string;
  /** -100..+100, positive = better than desired, negative = worse. */
  delta_score: number;
  /** Numeric delta when meaningful (e.g. dollars, days). */
  delta_value?: number;
  /** Optional formatted "+$150K" / "+3 days" / "−1 contingency". */
  delta_label?: string;
  sentiment: Sentiment;
  movability: Movability;
  /** Why this gap is what it is. */
  rationale: string;
  /** Concise tactical move to close the gap. */
  move: string;
}

export interface OfferDelta {
  offer_id: string;
  buyer_name: string;
  /** 0..100 — how close to the seller's desired outcome overall. */
  alignment_score: number;
  dimensions: DimensionDelta[];
  /** Easiest dimensions to move (most leverage, lowest friction). */
  easiest_moves: DimensionDelta[];
  /** Hardest dimensions to move (locked or expensive to shift). */
  hardest_moves: DimensionDelta[];
}

export interface SellerTarget {
  price: number;
  closeDays: number;
  /** Max acceptable contingencies (count). */
  maxContingencies: number;
  /** Acceptable concession dollars (0 = none). */
  maxConcessionsUSD: number;
  /** Plain-English desired leaseback. */
  leaseback: string;
  /** 0-100 minimum financial confidence the seller wants to see. */
  financingCertaintyMin: number;
}

export const defaultSellerTarget = (listingPrice: number): SellerTarget => ({
  price: Math.round(listingPrice * 1.03),
  closeDays: 30,
  maxContingencies: 1,
  maxConcessionsUSD: 0,
  leaseback: "Short rent-free leaseback OK",
  financingCertaintyMin: 90,
});

const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const clamp = (n: number, lo = -100, hi = 100) => Math.max(lo, Math.min(hi, n));

const sentimentFor = (delta: number): Sentiment => {
  if (delta >= 5) return "exceeds";
  if (delta >= -5) return "meets";
  if (delta >= -25) return "gap";
  return "large_gap";
};

const parseConcessionDollars = (c: string): number => {
  if (!c || /none|no /i.test(c)) return 0;
  const m = c.match(/\$?([\d,.]+)\s*(k|m)?/i);
  if (!m) return 0;
  const v = parseFloat(m[1].replace(/,/g, ""));
  if (!isFinite(v)) return 0;
  if (m[2]?.toLowerCase() === "k") return v * 1_000;
  if (m[2]?.toLowerCase() === "m") return v * 1_000_000;
  return v;
};

const leasebackTier = (s: string): number => {
  const t = (s || "None").toLowerCase();
  if (t === "none" || t.includes("no leaseback")) return 0;
  if (t.includes("flex")) return 1;
  if (t.match(/\b([1-9]|1[0-4])[-\s]?day/)) return 1;
  if (t.match(/\b(2[0-9]|30)[-\s]?day/)) return 2;
  if (t.match(/\b(60|90)[-\s]?day|month/)) return 3;
  return 2;
};

function buildPriceDelta(o: Offer, target: SellerTarget): DimensionDelta {
  const diff = o.offerPrice - target.price;
  const pct = (diff / Math.max(target.price, 1)) * 100;
  const score = clamp(pct * 4); // ±25% maps to ±100
  return {
    dimension: "price",
    label: "Price",
    desired: fmtUSD(target.price),
    actual: fmtUSD(o.offerPrice),
    delta_score: score,
    delta_value: diff,
    delta_label: `${diff >= 0 ? "+" : "−"}${fmtUSD(Math.abs(diff))} (${pct.toFixed(1)}%)`,
    sentiment: sentimentFor(score),
    movability: Math.abs(pct) < 2 ? "easy" : Math.abs(pct) < 5 ? "moderate" : "hard",
    rationale:
      diff >= 0
        ? `Already ${pct.toFixed(1)}% above the seller's number. Use the surplus to absorb structural concessions.`
        : `Sitting ${Math.abs(pct).toFixed(1)}% under the seller's number. Every dollar here is real — closing this gap takes a hard ask.`,
    move:
      diff >= 0
        ? "Hold price; trade nothing on it."
        : Math.abs(pct) < 3
        ? "Counter at target — buyer has runway to meet you."
        : "Price ask alone won't close this; bundle it with timing or leaseback wins.",
  };
}

function buildTimingDelta(o: Offer, target: SellerTarget): DimensionDelta {
  const days = o.closeDays || 30;
  const diff = target.closeDays - days; // +ve = buyer faster than seller wants
  const score = clamp(-diff * 4); // 5 days late = -20
  // Faster than target is fine but not always strictly better; treat ±5 as meeting.
  return {
    dimension: "timing",
    label: "Timing",
    desired: `${target.closeDays} days`,
    actual: `${days} days`,
    delta_score: clamp(-Math.abs(diff) * 3),
    delta_value: diff,
    delta_label: diff === 0 ? "Match" : `${diff > 0 ? "−" : "+"}${Math.abs(diff)} days vs target`,
    sentiment: Math.abs(diff) <= 5 ? "meets" : Math.abs(diff) <= 14 ? "gap" : "large_gap",
    movability: Math.abs(diff) <= 7 ? "easy" : Math.abs(diff) <= 14 ? "moderate" : "hard",
    rationale:
      diff === 0
        ? "Buyer's timeline matches the seller's target exactly."
        : diff > 0
        ? "Buyer wants to close faster than the seller planned — usually free leverage if logistics allow."
        : "Buyer needs more runway than the seller wants. Cost is mostly opportunity cost.",
    move:
      Math.abs(diff) <= 7
        ? "Accept the timeline; trade it for firmness elsewhere."
        : "Counter to target close ± 7 days; buyers usually flex on dates.",
  };
}

function buildContingenciesDelta(o: Offer, target: SellerTarget): DimensionDelta {
  const count = o.contingencies?.length ?? 0;
  const diff = target.maxContingencies - count; // +ve = under cap
  const score = clamp(diff * 25);
  return {
    dimension: "contingencies",
    label: "Contingencies",
    desired: target.maxContingencies === 0 ? "None" : `≤ ${target.maxContingencies}`,
    actual: count === 0 ? "None" : count === 1 ? "1 contingency" : `${count} contingencies`,
    delta_score: score,
    delta_value: -diff,
    delta_label: count === 0 ? "Clean" : `${count} on the table`,
    sentiment: sentimentFor(score),
    movability: count === 0 ? "locked" : count <= 2 ? "moderate" : "hard",
    rationale:
      count === 0
        ? "Already clean — nothing to renegotiate away."
        : `Buyer is keeping ${count} contingenc${count === 1 ? "y" : "ies"}. Each one is a path back to the table.`,
    move:
      count === 0
        ? "Lock the structure as-is."
        : "Counter to tighten inspection window and require appraisal gap coverage.",
  };
}

function buildConcessionsDelta(o: Offer, target: SellerTarget): DimensionDelta {
  const ask = parseConcessionDollars(o.concessions || "None");
  const diff = target.maxConcessionsUSD - ask; // +ve = under budget
  const score = clamp(diff === 0 ? 0 : -((ask / Math.max(target.price, 1)) * 1000));
  return {
    dimension: "concessions",
    label: "Concessions",
    desired: target.maxConcessionsUSD === 0 ? "$0" : `≤ ${fmtUSD(target.maxConcessionsUSD)}`,
    actual: ask === 0 ? "None" : fmtUSD(ask),
    delta_score: ask === 0 ? 5 : score,
    delta_value: -ask,
    delta_label: ask === 0 ? "No ask" : `−${fmtUSD(ask)} ask`,
    sentiment: ask === 0 ? "meets" : sentimentFor(score),
    movability: ask === 0 ? "locked" : ask <= 25_000 ? "easy" : "moderate",
    rationale:
      ask === 0
        ? "Buyer hasn't asked for any concessions — preserve this."
        : `Buyer asked for ${fmtUSD(ask)} — concession asks are anchors, not numbers.`,
    move:
      ask === 0
        ? "Hold; don't volunteer concessions."
        : "Counter with a smaller closing-cost credit (~30–40% of the ask).",
  };
}

function buildLeasebackDelta(o: Offer, target: SellerTarget): DimensionDelta {
  const buyer = leasebackTier(o.leasebackRequest);
  const desired = leasebackTier(target.leaseback);
  const diff = desired - buyer; // +ve = buyer offers less leaseback than seller wants (worse)
  const score = clamp(-Math.abs(diff) * 25 + (buyer >= desired ? 25 : 0));
  return {
    dimension: "leaseback",
    label: "Leaseback",
    desired: target.leaseback,
    actual: o.leasebackRequest || "None",
    delta_score: score,
    delta_label:
      buyer === desired
        ? "Aligned"
        : buyer > desired
        ? "Buyer flexible — extra runway"
        : "Buyer offers less leaseback than seller wants",
    sentiment: sentimentFor(score),
    movability: "easy",
    rationale:
      buyer >= desired
        ? "Leaseback ask is in the zone — usually a low-friction trade."
        : "Buyer hasn't volunteered leaseback. Almost always available if asked.",
    move:
      buyer >= desired
        ? "Accept; use as a chip to hold price."
        : "Add 7–14 day rent-free leaseback to the counter.",
  };
}

function buildFinancingDelta(o: Offer, target: SellerTarget, s?: ScoredOffer): DimensionDelta {
  const cert = s?.financialConfidence.score ?? (
    (o.financingType || "").toLowerCase().includes("cash") ? 95 :
    o.proofOfFunds && o.preApproval ? 80 : 60
  );
  const diff = cert - target.financingCertaintyMin;
  const score = clamp(diff * 2);
  return {
    dimension: "financing_certainty",
    label: "Financing Certainty",
    desired: `≥ ${target.financingCertaintyMin}/100`,
    actual: `${cert}/100`,
    delta_score: score,
    delta_value: diff,
    delta_label: `${diff >= 0 ? "+" : ""}${diff} vs target`,
    sentiment: sentimentFor(score),
    movability: cert >= 90 ? "locked" : cert >= 70 ? "moderate" : "hard",
    rationale:
      cert >= 90
        ? "Buyer's financial position is essentially bulletproof."
        : cert >= 70
        ? "Solid but verifiable — request fresh documentation to firm it up."
        : "Material uncertainty in the buyer's funding path. Verify or move on.",
    move:
      cert >= 90
        ? "No move needed."
        : cert >= 70
        ? "Require updated proof of funds or written pre-approval before counter acceptance."
        : "Make further negotiation contingent on documented financing within 48 hours.",
  };
}

export function computeOfferDelta(
  offer: Offer,
  target: SellerTarget,
  scores?: ScoredOffer,
): OfferDelta {
  const dimensions: DimensionDelta[] = [
    buildPriceDelta(offer, target),
    buildTimingDelta(offer, target),
    buildContingenciesDelta(offer, target),
    buildConcessionsDelta(offer, target),
    buildLeasebackDelta(offer, target),
    buildFinancingDelta(offer, target, scores),
  ];

  // Alignment = average of clamped 0..100 normalized scores.
  const alignment_score = Math.round(
    dimensions.reduce((sum, d) => sum + (50 + d.delta_score / 2), 0) / dimensions.length,
  );

  const movabilityRank: Record<Movability, number> = { easy: 0, moderate: 1, hard: 2, locked: 3 };

  const easiest_moves = dimensions
    .filter((d) => d.delta_score < 0 && d.movability !== "locked")
    .sort(
      (a, b) =>
        movabilityRank[a.movability] - movabilityRank[b.movability] ||
        a.delta_score - b.delta_score,
    )
    .slice(0, 3);

  const hardest_moves = dimensions
    .filter((d) => d.delta_score < -10)
    .sort(
      (a, b) =>
        movabilityRank[b.movability] - movabilityRank[a.movability] ||
        a.delta_score - b.delta_score,
    )
    .slice(0, 3);

  return {
    offer_id: offer.id,
    buyer_name: offer.buyerName,
    alignment_score,
    dimensions,
    easiest_moves,
    hardest_moves,
  };
}

export function computeDeltas(
  offers: Offer[],
  target: SellerTarget,
  scoresMap: Record<string, ScoredOffer | undefined>,
): OfferDelta[] {
  return offers.map((o) => computeOfferDelta(o, target, scoresMap[o.id]));
}

export function deriveTargetFromPriorities(
  listingPrice: number,
  weights?: SellerPriorityWeights | null,
): SellerTarget {
  const base = defaultSellerTarget(listingPrice);
  if (!weights) return base;
  // Adjust target using weights so the command center reflects the seller.
  return {
    ...base,
    price: Math.round(listingPrice * (1 + (weights.price_weight / 100) * 0.05)),
    closeDays: weights.speed_weight >= 70 ? 21 : weights.speed_weight >= 50 ? 30 : 45,
    maxContingencies: weights.contingencies_weight >= 70 ? 0 : 1,
    maxConcessionsUSD: 0,
    leaseback: weights.leaseback_weight >= 50 ? "Short rent-free leaseback OK" : "Prefer no leaseback",
    financingCertaintyMin: weights.financial_weight >= 70 ? 90 : 80,
  };
}
