import type { Offer } from "@/data/sampleData";
import type { ScoredOffer } from "@/lib/scoringEngine";
import type { LeverageSuggestion } from "@/lib/leverageEngine";
import type { SellerPriorityWeights } from "@/lib/offerService";

/**
 * Counter Strategy Builder — rules-based generator.
 *
 * Produces 3 strategy variants ("Maximize Price", "Maximize Certainty",
 * "Best Balance") tailored to a specific offer. The output schema mirrors
 * what an LLM-backed generator should return, so a future AI generator can
 * drop in without UI changes.
 */

export type StrategyType = "maximize_price" | "maximize_certainty" | "best_balance";

export interface ContingencyAdjustment {
  term: string;
  change: string;
  rationale: string;
}

export interface CounterStrategy {
  id: string;
  strategy_type: StrategyType;
  title: string;
  subtitle: string;

  /** Offer being countered. */
  target_offer_id: string;
  target_buyer: string;

  counter_price: number;
  /** Helpful presentational form e.g. "+$50K vs offer". */
  counter_price_delta: string;

  close_timeline: string;
  /** Numeric days for downstream math. */
  close_days: number;

  contingency_changes: ContingencyAdjustment[];
  leaseback_terms: string;
  deposit_recommendation: string;
  supporting_document_requests: string[];

  rationale: string;
  acceptance_likelihood: number; // 0-100
  acceptance_likelihood_description: string;
  risk: string;

  /** Strategy chosen as overall recommendation. */
  recommended: boolean;
  /** Provenance — `rules` for now, `ai` once an AI generator is wired in. */
  source: "rules" | "ai";
}

interface BuildContext {
  offers: Offer[];
  scores: Record<string, ScoredOffer | undefined>;
  leverage: LeverageSuggestion[];
  priorities?: SellerPriorityWeights | null;
  listingPrice: number;
  sellerGoals?: string[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const round = (n: number, step = 1000) => Math.round(n / step) * step;

const pickByImpact = (
  leverage: LeverageSuggestion[],
  offerId: string,
  category: string,
): LeverageSuggestion | undefined =>
  leverage.find((l) => l.offer_id === offerId && l.category === category);

/* ── Offer-scoring heuristics for picking the right target per strategy ── */

const priceScore = (o: Offer) => o.offerPrice;
const certaintyScore = (o: Offer, s?: ScoredOffer) =>
  (s?.closeProbability.score ?? 50) * 0.5 +
  (s?.financialConfidence.score ?? 50) * 0.3 +
  (s?.packageCompleteness.score ?? 50) * 0.2;
const balanceScore = (o: Offer, s?: ScoredOffer, w?: SellerPriorityWeights | null) => {
  const p = w ?? defaultWeights();
  const norm = (n: number) => n / 100;
  const priceN = (o.offerPrice / 12_000_000) * 100;
  return (
    priceN * norm(p.price_weight) +
    (s?.closeProbability.score ?? 50) * norm(p.certainty_weight) +
    (100 - (s?.contingencyRisk.score ?? 50)) * norm(p.contingencies_weight) +
    (100 - (s?.timingRisk.score ?? 50)) * norm(p.speed_weight) +
    (s?.financialConfidence.score ?? 50) * norm(p.financial_weight)
  );
};

const defaultWeights = (): SellerPriorityWeights => ({
  price_weight: 80,
  certainty_weight: 70,
  contingencies_weight: 60,
  speed_weight: 50,
  leaseback_weight: 30,
  repair_weight: 40,
  financial_weight: 65,
});

const best = <T,>(items: T[], by: (t: T) => number): T | undefined =>
  items.length ? items.reduce((a, b) => (by(b) > by(a) ? b : a)) : undefined;

/* ── Strategy builders ── */

function buildMaximizePrice(ctx: BuildContext): CounterStrategy | null {
  const target = best(ctx.offers, priceScore);
  if (!target) return null;
  const score = ctx.scores[target.id];
  const counterPrice = round(Math.max(target.offerPrice * 1.005, target.offerPrice + 25_000), 5_000);
  const isCash = (target.financingType || "").toLowerCase().includes("cash");
  const lev = ctx.leverage.filter((l) => l.offer_id === target.id);

  const contingencyChanges: ContingencyAdjustment[] = [];
  const inspection = pickByImpact(lev, target.id, "contingency");
  if (inspection) {
    contingencyChanges.push({
      term: "Inspection",
      change: "Tighten to 5–7 days",
      rationale: inspection.headline,
    });
  } else {
    contingencyChanges.push({
      term: "Inspection",
      change: "Hold to 7 days",
      rationale: "Signals seller intent without giving back leverage on price.",
    });
  }
  if (!isCash) {
    contingencyChanges.push({
      term: "Appraisal",
      change: "Require $200K gap coverage",
      rationale: "Protects the price ask against thin luxury comps.",
    });
  } else {
    contingencyChanges.push({
      term: "Appraisal",
      change: "Waived (cash)",
      rationale: "No appraisal exposure — the price ask carries clean.",
    });
  }
  contingencyChanges.push({
    term: "Repairs",
    change: "Sold as-is",
    rationale: "Eliminates a common renegotiation path back to a lower net.",
  });

  const acceptance = isCash
    ? Math.max(60, Math.min(85, 75 - Math.round(((counterPrice - target.offerPrice) / target.offerPrice) * 1000)))
    : 55;

  return {
    id: `maximize_price-${target.id}`,
    strategy_type: "maximize_price",
    title: "Maximize Price",
    subtitle: `Push for top dollar from ${target.buyerName}`,
    target_offer_id: target.id,
    target_buyer: target.buyerName,
    counter_price: counterPrice,
    counter_price_delta: deltaLabel(counterPrice - target.offerPrice),
    close_timeline: `${target.closeDays || 30} days`,
    close_days: target.closeDays || 30,
    contingency_changes: contingencyChanges,
    leaseback_terms: leasebackOffer(target, "short"),
    deposit_recommendation: depositRec(target, counterPrice, "firm"),
    supporting_document_requests: docRequests(target, "verify"),
    rationale: priceRationale(target, counterPrice, score, isCash),
    acceptance_likelihood: acceptance,
    acceptance_likelihood_description: priceAcceptanceCopy(target, counterPrice, isCash),
    risk:
      "If the buyer reads the counter as overreach, you risk losing momentum. Keep concessions ready to deploy if they push back hard on inspection or appraisal.",
    recommended: false,
    source: "rules",
  };
}

function buildMaximizeCertainty(ctx: BuildContext): CounterStrategy | null {
  const target = best(ctx.offers, (o) => certaintyScore(o, ctx.scores[o.id]));
  if (!target) return null;
  const score = ctx.scores[target.id];
  // Hold close to their offer; the play is structure, not price.
  const counterPrice = round(Math.max(target.offerPrice, target.offerPrice * 0.998), 5_000);
  const isCash = (target.financingType || "").toLowerCase().includes("cash");
  const lev = ctx.leverage.filter((l) => l.offer_id === target.id);

  const contingencyChanges: ContingencyAdjustment[] = [];
  contingencyChanges.push({
    term: "Inspection",
    change: "Standard 10 days, no waivers",
    rationale: "Don't squeeze a buyer who's already organized — you want them to sign cleanly.",
  });
  if (!isCash) {
    const gap = pickByImpact(lev, target.id, "appraisal");
    contingencyChanges.push({
      term: "Appraisal",
      change: "Require $150–200K gap coverage",
      rationale: gap?.headline ?? "The single biggest deal-killer in this segment — neutralize it.",
    });
  }
  contingencyChanges.push({
    term: "Repairs",
    change: "As-is with $15K credit",
    rationale: "Trade a known number for the certainty that no late-stage repair list shows up.",
  });

  return {
    id: `maximize_certainty-${target.id}`,
    strategy_type: "maximize_certainty",
    title: "Maximize Certainty",
    subtitle: "Lock in the most reliable path to close",
    target_offer_id: target.id,
    target_buyer: target.buyerName,
    counter_price: counterPrice,
    counter_price_delta: deltaLabel(counterPrice - target.offerPrice),
    close_timeline: `${target.closeDays || 30} days`,
    close_days: target.closeDays || 30,
    contingency_changes: contingencyChanges,
    leaseback_terms: leasebackOffer(target, "extended"),
    deposit_recommendation: depositRec(target, counterPrice, "moderate"),
    supporting_document_requests: docRequests(target, "minimal"),
    rationale: certaintyRationale(target, counterPrice, score, isCash),
    acceptance_likelihood: Math.max(80, Math.min(95, Math.round((score?.closeProbability.score ?? 80) * 0.95))),
    acceptance_likelihood_description:
      "This is the version of the deal the buyer expects to see. Few asks, all reasonable, no friction with their financing path.",
    risk:
      "You leave dollars on the table relative to the highest-priced path. If a back-up offer comes in materially higher, this strategy looks more conservative in hindsight.",
    recommended: false,
    source: "rules",
  };
}

function buildBestBalance(ctx: BuildContext): CounterStrategy | null {
  const target = best(ctx.offers, (o) => balanceScore(o, ctx.scores[o.id], ctx.priorities));
  if (!target) return null;
  const score = ctx.scores[target.id];
  // Modest bump on price + tightened structure.
  const counterPrice = round(target.offerPrice * 1.015, 5_000);
  const isCash = (target.financingType || "").toLowerCase().includes("cash");
  const lev = ctx.leverage.filter((l) => l.offer_id === target.id);

  const contingencyChanges: ContingencyAdjustment[] = [];
  contingencyChanges.push({
    term: "Inspection",
    change: "Tighten to 7 days",
    rationale: "Reasonable in this segment — narrows the renegotiation window without antagonizing.",
  });
  if (!isCash) {
    const gap = pickByImpact(lev, target.id, "appraisal");
    contingencyChanges.push({
      term: "Appraisal",
      change: gap ? "Maintain or add $150K gap coverage" : "Standard with cap",
      rationale: gap?.headline ?? "Standard guardrail in luxury finance.",
    });
  }
  contingencyChanges.push({
    term: "Repairs",
    change: "As-is, no credits",
    rationale: "Pair the price ask with structural simplicity — fewer surfaces to renegotiate.",
  });

  return {
    id: `best_balance-${target.id}`,
    strategy_type: "best_balance",
    title: "Best Balance",
    subtitle: "Most likely path to a deal both sides feel good about",
    target_offer_id: target.id,
    target_buyer: target.buyerName,
    counter_price: counterPrice,
    counter_price_delta: deltaLabel(counterPrice - target.offerPrice),
    close_timeline: `${target.closeDays || 30} days`,
    close_days: target.closeDays || 30,
    contingency_changes: contingencyChanges,
    leaseback_terms: leasebackOffer(target, "balanced"),
    deposit_recommendation: depositRec(target, counterPrice, "balanced"),
    supporting_document_requests: docRequests(target, "balanced"),
    rationale: balanceRationale(target, counterPrice, score, isCash, ctx.priorities),
    acceptance_likelihood: 82,
    acceptance_likelihood_description:
      "Every ask is defensible and proportional. Buyers in this position usually counter once on price and accept the rest — which is exactly the negotiation you want.",
    risk:
      "If the buyer counters back on price, hold firm — the structural concessions you've already built in are the value.",
    recommended: true,
    source: "rules",
  };
}

/* ── Helper copy ── */

function deltaLabel(delta: number): string {
  if (Math.abs(delta) < 1000) return "Match offer";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${fmt(Math.abs(delta))} vs their offer`;
}

function leasebackOffer(o: Offer, posture: "short" | "balanced" | "extended"): string {
  const requested = (o.leasebackRequest || "None").toLowerCase();
  if (posture === "short") return "7-day rent-free leaseback";
  if (posture === "extended") return requested.includes("none") ? "Up to 14-day rent-free leaseback if needed" : "Honor requested leaseback in full";
  return "10-day rent-free leaseback (split the difference)";
}

function depositRec(o: Offer, counterPrice: number, posture: "firm" | "moderate" | "balanced"): string {
  const target =
    posture === "firm" ? counterPrice * 0.033 :
    posture === "moderate" ? Math.max(o.earnestMoney, counterPrice * 0.025) :
    Math.max(o.earnestMoney * 1.25, counterPrice * 0.028);
  const rounded = round(target, 5_000);
  const delta = rounded - (o.earnestMoney || 0);
  const deltaLabelStr = delta > 0 ? ` (+${fmt(delta)} from their offer)` : "";
  return `${fmt(rounded)}${deltaLabelStr}`;
}

function docRequests(o: Offer, mode: "verify" | "minimal" | "balanced"): string[] {
  const out: string[] = [];
  const isCash = (o.financingType || "").toLowerCase().includes("cash");
  if (mode === "verify") {
    if (isCash) out.push("Updated proof of funds within 48 hours");
    if (!o.proofOfFunds) out.push("Bank-stamped proof of funds");
    if (!o.preApproval) out.push("Written pre-approval from named lender");
    out.push("Wire confirmation on earnest money within 72 hours");
  } else if (mode === "minimal") {
    if (!o.proofOfFunds) out.push("Refreshed proof of funds");
    out.push("Final loan commitment letter");
  } else {
    if (!o.preApproval) out.push("Refreshed pre-approval");
    out.push("Written confirmation of appraisal gap coverage");
    out.push("Wire confirmation on earnest money");
  }
  return Array.from(new Set(out));
}

function priceRationale(o: Offer, counter: number, s: ScoredOffer | undefined, isCash: boolean): string {
  const motivation = isCash ? "all-cash buyer" : "well-qualified financed buyer";
  const conf = s ? `Close-probability score is ${s.closeProbability.score}/100 with financial confidence at ${s.financialConfidence.score}/100.` : "";
  return `${o.buyerName} came in at ${fmt(o.offerPrice)} as ${motivation}. ${conf} Counter at ${fmt(counter)} and pair the ask with a tight inspection window and as-is structure — every term protects the price you're holding. The leaseback and timeline match what they asked for, so the only thing to negotiate back on is structure, not the price.`;
}

function certaintyRationale(o: Offer, counter: number, s: ScoredOffer | undefined, isCash: boolean): string {
  const completeness = s ? `Package completeness scored ${s.packageCompleteness.score}/100.` : "";
  return `${o.buyerName} is the most reliable path to close in the package. ${completeness} The play here is structure, not price — hold close to their offer at ${fmt(counter)}, accept their timeline, and add only the protections that matter (${isCash ? "verified funds" : "appraisal gap coverage"} and a defined repair credit). You give up some upside versus the highest-priced path, but you remove almost every reason this deal would fall apart.`;
}

function balanceRationale(o: Offer, counter: number, s: ScoredOffer | undefined, isCash: boolean, w?: SellerPriorityWeights | null): string {
  const tilt = w
    ? (w.price_weight >= w.certainty_weight ? "the seller's stated tilt toward maximizing price" : "the seller's stated tilt toward closing certainty")
    : "the seller's balanced priorities";
  return `${o.buyerName} sits where price, structure, and certainty intersect. Counter at ${fmt(counter)} — a defensible bump that respects ${tilt} — tighten inspection to 7 days, and pair it with ${isCash ? "verified funds" : "appraisal gap coverage"}. Every ask is reasonable on its own, and the cumulative structure is a deal worth signing for both sides.`;
}

function priceAcceptanceCopy(o: Offer, counter: number, isCash: boolean): string {
  const pct = ((counter - o.offerPrice) / Math.max(o.offerPrice, 1)) * 100;
  if (isCash) return `Cash buyer asked at ${fmt(o.offerPrice)} — a ${pct.toFixed(1)}% bump is in the negotiable range, but expect one round of pushback before they sign.`;
  return `Asking ${pct.toFixed(1)}% above their offer is plausible only if the rest of the structure is friendly to them — keep concessions ready.`;
}

/* ── Public entry ── */

export interface CounterStrategyBundle {
  strategies: CounterStrategy[];
  generated_at: string;
  source: "rules" | "ai";
}

export function generateCounterStrategies(ctx: BuildContext): CounterStrategyBundle {
  const out: CounterStrategy[] = [];
  const a = buildMaximizePrice(ctx);
  const b = buildMaximizeCertainty(ctx);
  const c = buildBestBalance(ctx);
  if (a) out.push(a);
  if (b) out.push(b);
  if (c) out.push(c);
  return { strategies: out, generated_at: new Date().toISOString(), source: "rules" };
}
