import type { Offer } from "@/data/sampleData";
import type { ScoredOffer } from "@/lib/scoringEngine";
import type { LeverageSuggestion } from "@/lib/leverageEngine";
import type { CounterStrategy } from "@/lib/counterStrategyEngine";
import type { SellerPriorityWeights } from "@/lib/offerService";

/**
 * Recommendation Report engine.
 *
 * Synthesizes the analysis-wide recommendations from offers, scores,
 * priorities, leverage and counter strategies. Output is plain-English,
 * agent-tone, and structured so it can later be replaced by an
 * AI-generated report without changing the UI.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const defaultWeights = (): SellerPriorityWeights => ({
  price_weight: 80,
  certainty_weight: 70,
  contingencies_weight: 60,
  speed_weight: 50,
  leaseback_weight: 30,
  repair_weight: 40,
  financial_weight: 65,
});

export interface RecommendationPick {
  offer_id: string;
  buyer_name: string;
  offer_price: number;
  headline: string;
  explanation: string;
  /** A few short proof points the agent can read off. */
  proof_points: string[];
}

export interface RiskCallout {
  /** Optional offer the risk is tied to. */
  offer_id?: string;
  buyer_name?: string;
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
}

export interface NegotiationStep {
  order: number;
  headline: string;
  detail: string;
}

export interface RecommendationReport {
  source: "rules" | "ai";
  generated_at: string;

  best_overall: RecommendationPick;
  safest: RecommendationPick;
  highest: RecommendationPick;
  best_fit: RecommendationPick;

  top_risks: RiskCallout[];
  negotiation_path: NegotiationStep[];

  suggested_counter: {
    strategy_type: CounterStrategy["strategy_type"];
    title: string;
    target_buyer: string;
    counter_price: number;
    headline: string;
    rationale: string;
    acceptance_likelihood: number;
  } | null;

  /** Closing paragraph an agent can read aloud. */
  bottom_line: string;
}

interface BuildContext {
  offers: Offer[];
  scores: Record<string, ScoredOffer | undefined>;
  leverage: LeverageSuggestion[];
  strategies: CounterStrategy[];
  priorities?: SellerPriorityWeights | null;
  listingPrice: number;
  sellerGoals?: string[];
}

const isCash = (o: Offer) => (o.financingType || "").toLowerCase().includes("cash");

const certaintyScore = (o: Offer, s?: ScoredOffer) =>
  (s?.closeProbability.score ?? 50) * 0.5 +
  (s?.financialConfidence.score ?? 50) * 0.3 +
  (s?.packageCompleteness.score ?? 50) * 0.2;

const overallScore = (o: Offer, s?: ScoredOffer) =>
  (s?.offerStrength.score ?? 50) * 0.35 +
  (s?.closeProbability.score ?? 50) * 0.30 +
  (s?.financialConfidence.score ?? 50) * 0.15 +
  (100 - (s?.contingencyRisk.score ?? 50)) * 0.10 +
  (100 - (s?.timingRisk.score ?? 50)) * 0.10;

const fitScore = (o: Offer, s?: ScoredOffer, w?: SellerPriorityWeights | null, listing = 0) => {
  const p = w ?? defaultWeights();
  const norm = (n: number) => n / 100;
  const priceN = listing ? Math.min(120, (o.offerPrice / listing) * 100) : 50;
  return (
    priceN * norm(p.price_weight) +
    (s?.closeProbability.score ?? 50) * norm(p.certainty_weight) +
    (100 - (s?.contingencyRisk.score ?? 50)) * norm(p.contingencies_weight) +
    (100 - (s?.timingRisk.score ?? 50)) * norm(p.speed_weight) +
    (s?.financialConfidence.score ?? 50) * norm(p.financial_weight)
  );
};

const best = <T,>(items: T[], by: (t: T) => number): T | undefined =>
  items.length ? items.reduce((a, b) => (by(b) > by(a) ? b : a)) : undefined;

function pickProofPoints(o: Offer, s?: ScoredOffer): string[] {
  const out: string[] = [];
  if (isCash(o)) out.push("All-cash buyer — no lender in the picture.");
  else if (o.downPaymentPercent >= 30) out.push(`${o.downPaymentPercent}% down — financially deep.`);
  if (o.contingencies.length === 0) out.push("Zero contingencies on the table.");
  else if (o.contingencies.length === 1) out.push("Only one contingency — clean structure.");
  if (o.closeDays && o.closeDays <= 25) out.push(`${o.closeDays}-day close — fast and decisive.`);
  if (s) {
    if (s.closeProbability.score >= 85) out.push(`${s.closeProbability.score}% close probability.`);
    if (s.packageCompleteness.score >= 90) out.push("Package is fully documented.");
  }
  if (o.proofOfFunds && o.preApproval) out.push("Both proof of funds and pre-approval verified.");
  return out.slice(0, 4);
}

function bestOverallPick(ctx: BuildContext): RecommendationPick {
  const t = best(ctx.offers, (o) => overallScore(o, ctx.scores[o.id]))!;
  const s = ctx.scores[t.id];
  const cash = isCash(t);
  const explanation = `If you had to pick one offer to take to the closing table today, this is it. ${t.buyerName} came in at ${fmt(t.offerPrice)} ${cash ? "in cash" : `with ${t.downPaymentPercent}% down`}, and the rest of the package backs the price up — ${t.contingencies.length === 0 ? "no contingencies" : `${t.contingencies.length} contingenc${t.contingencies.length === 1 ? "y" : "ies"}`} and a ${t.closeDays || 30}-day close. It's the offer that scores highest when you weigh price, structure and certainty together.`;
  return {
    offer_id: t.id,
    buyer_name: t.buyerName,
    offer_price: t.offerPrice,
    headline: `${t.buyerName} — ${cash ? "all-cash" : "financed"} at ${fmt(t.offerPrice)}`,
    explanation,
    proof_points: pickProofPoints(t, s),
  };
}

function safestPick(ctx: BuildContext): RecommendationPick {
  const t = best(ctx.offers, (o) => certaintyScore(o, ctx.scores[o.id]))!;
  const s = ctx.scores[t.id];
  const explanation = `If certainty matters more than squeezing out the last dollar, ${t.buyerName} is the answer. ${s?.packageCompleteness.score ?? 80}% of the paperwork is in order, financial confidence sits at ${s?.financialConfidence.score ?? 80}/100, and the close-probability model puts this one at ${s?.closeProbability.score ?? 85}%. At ${fmt(t.offerPrice)} the price is competitive — and you can actually count on it crossing the finish line.`;
  return {
    offer_id: t.id,
    buyer_name: t.buyerName,
    offer_price: t.offerPrice,
    headline: `Most reliable path to close · ${fmt(t.offerPrice)}`,
    explanation,
    proof_points: pickProofPoints(t, s),
  };
}

function highestPick(ctx: BuildContext): RecommendationPick {
  const t = best(ctx.offers, (o) => o.offerPrice)!;
  const s = ctx.scores[t.id];
  const conts = t.contingencies.length;
  const days = t.closeDays || 30;
  const baggage =
    conts >= 3 || days >= 40
      ? `It comes with real baggage though — ${conts} contingenc${conts === 1 ? "y" : "ies"} over a ${days}-day window. The price is appealing; the question is whether you're willing to spend that long finding out if it actually closes.`
      : `And the structure is reasonable — ${conts} contingenc${conts === 1 ? "y" : "ies"} and a ${days}-day close. Worth taking seriously, not just chasing.`;
  const explanation = `${fmt(t.offerPrice)} is the biggest number on the table, from ${t.buyerName}. ${baggage}`;
  return {
    offer_id: t.id,
    buyer_name: t.buyerName,
    offer_price: t.offerPrice,
    headline: `Top dollar on the table · ${fmt(t.offerPrice)}`,
    explanation,
    proof_points: pickProofPoints(t, s),
  };
}

function bestFitPick(ctx: BuildContext): RecommendationPick {
  const t = best(ctx.offers, (o) => fitScore(o, ctx.scores[o.id], ctx.priorities, ctx.listingPrice))!;
  const s = ctx.scores[t.id];
  const w = ctx.priorities ?? defaultWeights();
  const tilt =
    w.price_weight >= w.certainty_weight + 10
      ? "you've told us price matters most"
      : w.certainty_weight >= w.price_weight + 10
      ? "you've told us certainty matters most"
      : "your priorities are balanced between price and certainty";
  const explanation = `When you map this against what the seller actually cares about — ${tilt} — ${t.buyerName} checks the most boxes. Strong on price at ${fmt(t.offerPrice)}, ${isCash(t) ? "cash" : "financed but well-qualified"}, and the structural terms line up with the close timeline and leaseback flexibility you've prioritized.`;
  return {
    offer_id: t.id,
    buyer_name: t.buyerName,
    offer_price: t.offerPrice,
    headline: `Best fit for your priorities · ${fmt(t.offerPrice)}`,
    explanation,
    proof_points: pickProofPoints(t, s),
  };
}

function buildTopRisks(ctx: BuildContext): RiskCallout[] {
  const out: RiskCallout[] = [];

  // Highest-priced offer with stacked contingencies.
  const high = best(ctx.offers, (o) => o.offerPrice);
  if (high && (high.contingencies.length >= 3 || (high.closeDays || 0) >= 40)) {
    out.push({
      offer_id: high.id,
      buyer_name: high.buyerName,
      severity: "high",
      title: `${high.buyerName}'s headline price comes with optionality`,
      explanation: `${fmt(high.offerPrice)} looks great on paper, but ${high.contingencies.length} contingenc${high.contingencies.length === 1 ? "y" : "ies"} over a ${high.closeDays || 30}-day window means the buyer has multiple clean exit points if anything shifts. Don't anchor the seller to a number you can't actually count on.`,
    });
  }

  // Missing financial proof.
  for (const o of ctx.offers) {
    if (!o.proofOfFunds && isCash(o)) {
      out.push({
        offer_id: o.id,
        buyer_name: o.buyerName,
        severity: "high",
        title: `${o.buyerName} hasn't shown verified funds`,
        explanation: `An all-cash offer without a stamped proof of funds is essentially a verbal promise. Until that document is in hand, treat the price as conditional.`,
      });
      break;
    }
  }
  for (const o of ctx.offers) {
    if (!isCash(o) && !o.preApproval) {
      out.push({
        offer_id: o.id,
        buyer_name: o.buyerName,
        severity: "medium",
        title: `${o.buyerName} is missing a written pre-approval`,
        explanation: `Financed offer without a current pre-approval letter from the named lender. Request it before the seller commits to anything more than a counter.`,
      });
      break;
    }
  }

  // Appraisal exposure on financed offers.
  const financedNoGap = ctx.offers.find(
    (o) => !isCash(o) && !(o.appraisalTerms || "").toLowerCase().includes("gap") && !(o.appraisalTerms || "").toLowerCase().includes("waived"),
  );
  if (financedNoGap) {
    out.push({
      offer_id: financedNoGap.id,
      buyer_name: financedNoGap.buyerName,
      severity: "medium",
      title: `${financedNoGap.buyerName} carries appraisal exposure`,
      explanation: `Standard appraisal contingency on a luxury comp set that can run thin. If the appraisal comes in low, you're back at the table. Bake gap coverage into any counter.`,
    });
  }

  // Long contingency window across the field.
  const longest = best(ctx.offers, (o) => o.closeDays || 0);
  if (longest && (longest.closeDays || 0) >= 45 && !out.some((r) => r.offer_id === longest.id)) {
    out.push({
      offer_id: longest.id,
      buyer_name: longest.buyerName,
      severity: "medium",
      title: `${longest.buyerName}'s timeline gives away momentum`,
      explanation: `A ${longest.closeDays}-day window is a long time for the market to move. The longer you wait, the more chances either side has to lose conviction.`,
    });
  }

  // Generic mindfulness note — keep it human.
  out.push({
    severity: "low",
    title: "Watch the buyer-fatigue clock",
    explanation: "Juggling multiple counters works only if you keep moving. The strongest buyers won't wait around indefinitely — set internal deadlines and stick to them.",
  });

  return out.slice(0, 4);
}

function buildNegotiationPath(ctx: BuildContext, bestOverall: Offer, safest: Offer, highest: Offer): NegotiationStep[] {
  const recommended = ctx.strategies.find((s) => s.recommended) ?? ctx.strategies[0];
  const lead = recommended ? ctx.offers.find((o) => o.id === recommended.target_offer_id) ?? bestOverall : bestOverall;
  const backup = ctx.offers.find((o) => o.id !== lead.id && o.offerPrice >= lead.offerPrice * 0.97) ?? highest;
  const fallback = safest.id !== lead.id ? safest : ctx.offers.find((o) => o.id !== lead.id) ?? lead;

  const steps: NegotiationStep[] = [];

  steps.push({
    order: 1,
    headline: `Lead with ${lead.buyerName}`,
    detail: recommended
      ? `Counter at ${fmt(recommended.counter_price)}, ${recommended.contingency_changes[0]?.change.toLowerCase() ?? "tighten the inspection window"}, and pair it with ${recommended.leaseback_terms.toLowerCase()}. ${isCash(lead) ? "They're cash and motivated — this is your most direct line to top dollar." : "Well-qualified buyer who'll respect a clean, decisive counter."}`
      : `Open with a counter at the right price for them and tighten the structural terms — ${isCash(lead) ? "all-cash buyer, treat it accordingly." : "financed but well-qualified."}`,
  });

  if (backup.id !== lead.id) {
    steps.push({
      order: 2,
      headline: `Run a parallel counter to ${backup.buyerName}`,
      detail: `Don't let ${backup.buyerName} go cold while you wait. Keep them warm with a ${fmt(Math.round(backup.offerPrice * 1.005))} counter and ${isCash(backup) ? "verified funds within 48 hours" : "written confirmation of appraisal gap coverage"}. If the lead falls through, you want this one already in motion.`,
    });
  }

  steps.push({
    order: steps.length + 1,
    headline: lead === highestPickOffer(ctx) ? "If they accept, you're done" : `If ${lead.buyerName} accepts, lock it in`,
    detail: `Best price in the realistic range, fastest path to close, cleanest structure. If they counter back, you have ${backup.buyerName} as an active fallback without losing momentum.`,
  });

  if (fallback.id !== lead.id && fallback.id !== backup.id) {
    steps.push({
      order: steps.length + 1,
      headline: `Keep ${fallback.buyerName} in the back pocket`,
      detail: `They're not going anywhere — package is complete and they're flexible. If everything else falls apart, this is the deal that still closes at ${fmt(fallback.offerPrice)}.`,
    });
  }

  return steps;
}

function highestPickOffer(ctx: BuildContext): Offer | undefined {
  return best(ctx.offers, (o) => o.offerPrice);
}

function buildSuggestedCounter(ctx: BuildContext): RecommendationReport["suggested_counter"] {
  const recommended = ctx.strategies.find((s) => s.recommended) ?? ctx.strategies[0];
  if (!recommended) return null;
  return {
    strategy_type: recommended.strategy_type,
    title: recommended.title,
    target_buyer: recommended.target_buyer,
    counter_price: recommended.counter_price,
    headline: `${recommended.title} → counter ${recommended.target_buyer} at ${fmt(recommended.counter_price)}`,
    rationale: recommended.rationale,
    acceptance_likelihood: recommended.acceptance_likelihood,
  };
}

function buildBottomLine(ctx: BuildContext, bestOverall: Offer, safest: Offer, highest: Offer): string {
  const count = ctx.offers.length;
  const sameTop = bestOverall.id === safest.id;
  if (sameTop) {
    return `You have ${count} real offers, and the picture is clean: ${bestOverall.buyerName} is both your strongest and your safest path. Counter on terms — not price — and keep the rest of the field warm in case anything shifts. Don't get distracted by the highest headline number unless the buyer is willing to drop contingencies to back it up.`;
  }
  return `You have ${count} real offers on a property the market has responded well to. The strongest play is to counter ${bestOverall.buyerName} aggressively on terms while keeping the rest of the field engaged. Don't get pulled toward ${highest.buyerName}'s ${fmt(highest.offerPrice)} unless they're willing to give up real contingency surface — the execution risk isn't worth it. And if certainty becomes the priority, ${safest.buyerName} is sitting right there with a deal you can count on.`;
}

/* ── Public API ── */

export function generateRecommendationReport(ctx: BuildContext): RecommendationReport {
  const bestOverall = bestOverallPick(ctx);
  const safest = safestPick(ctx);
  const highest = highestPick(ctx);
  const bestFit = bestFitPick(ctx);

  const bestOfferObj = ctx.offers.find((o) => o.id === bestOverall.offer_id)!;
  const safestObj = ctx.offers.find((o) => o.id === safest.offer_id)!;
  const highestObj = ctx.offers.find((o) => o.id === highest.offer_id)!;

  return {
    source: "rules",
    generated_at: new Date().toISOString(),
    best_overall: bestOverall,
    safest,
    highest,
    best_fit: bestFit,
    top_risks: buildTopRisks(ctx),
    negotiation_path: buildNegotiationPath(ctx, bestOfferObj, safestObj, highestObj),
    suggested_counter: buildSuggestedCounter(ctx),
    bottom_line: buildBottomLine(ctx, bestOfferObj, safestObj, highestObj),
  };
}