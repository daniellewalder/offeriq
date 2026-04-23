import type { Offer } from "@/data/sampleData";
import type { ScoredOffer } from "@/lib/scoringEngine";
import type { CounterStrategy } from "@/lib/counterStrategyEngine";
import type { LeverageSuggestion } from "@/lib/leverageEngine";
import type { SellerPriorityWeights } from "@/lib/offerService";
import {
  generateRecommendationReport,
  type RecommendationReport,
} from "@/lib/recommendationEngine";

/**
 * Seller-facing presentation layer.
 *
 * Wraps the agent-tone RecommendationReport with extra plain-English
 * helpers, label classification (Highest / Safest / Cleanest / Best Balance),
 * and per-offer "what this means for you" summaries used by both the PDF
 * and the seller portal.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export type SellerLabel =
  | "Highest"
  | "Safest"
  | "Cleanest"
  | "Best Balance"
  | "Strongest Financials"
  | "Fastest Close";

export interface SellerOfferCard {
  offer: Offer;
  scores?: ScoredOffer;
  labels: SellerLabel[];
  /** One-line plain-English headline for the seller. */
  headline: string;
  /** 2–3 sentence "what this means for you" summary. */
  what_this_means: string;
  /** Plain-English bullets — easy wins & worth-knowing tradeoffs. */
  pros: string[];
  cons: string[];
  /** Concise risk note. */
  risk_note: string;
  /** A simple 0–100 alignment score for the seller. */
  fit: number;
}

export interface SellerOverview {
  total_offers: number;
  top_recommendation: { buyer: string; price: number; reason: string };
  highest: { buyer: string; price: number; reason: string };
  safest: { buyer: string; price: number; reason: string };
  best_balance: { buyer: string; price: number; reason: string };
}

export interface SellerTradeoff {
  title: string;
  body: string;
}

export interface SellerPresentation {
  property: {
    address: string;
    city?: string;
    listing_price: number;
    prepared_on: string;
    agent_name?: string;
    agent_brokerage?: string;
  };
  overview: SellerOverview;
  executive_summary: string;
  priority_summary: { label: string; weight: number }[];
  cards: SellerOfferCard[];
  tradeoffs: SellerTradeoff[];
  comparison_rows: ComparisonRow[];
  report: RecommendationReport;
  bottom_line_for_seller: string;
}

export interface ComparisonRow {
  label: string;
  values: string[];
}

const isCash = (o: Offer) =>
  (o.financingType || "").toLowerCase().includes("cash");

function priorityLabels(p?: SellerPriorityWeights | null) {
  const w = p ?? {
    price_weight: 80,
    certainty_weight: 70,
    contingencies_weight: 60,
    speed_weight: 50,
    leaseback_weight: 30,
    repair_weight: 40,
    financial_weight: 65,
  };
  return [
    { label: "Top dollar", weight: w.price_weight },
    { label: "Certainty of closing", weight: w.certainty_weight },
    { label: "Fewer contingencies", weight: w.contingencies_weight },
    { label: "Speed to close", weight: w.speed_weight },
    { label: "Leaseback flexibility", weight: w.leaseback_weight },
    { label: "No repair drama", weight: w.repair_weight },
    { label: "Buyer financial strength", weight: w.financial_weight },
  ].sort((a, b) => b.weight - a.weight);
}

function buildCard(
  offer: Offer,
  scores: ScoredOffer | undefined,
  listingPrice: number,
): SellerOfferCard {
  const cash = isCash(offer);
  const above = listingPrice
    ? Math.round(((offer.offerPrice - listingPrice) / listingPrice) * 1000) / 10
    : 0;
  const aboveStr =
    above > 0
      ? `${above}% above asking`
      : above < 0
      ? `${Math.abs(above)}% below asking`
      : "right at asking";

  const pros: string[] = [];
  const cons: string[] = [];

  if (cash) pros.push("All-cash buyer — no lender needed.");
  else pros.push(`${offer.downPaymentPercent}% down with financing in place.`);

  if (offer.contingencies.length === 0) pros.push("No contingencies attached.");
  else if (offer.contingencies.length === 1)
    pros.push("Only one contingency — a clean structure.");
  else
    cons.push(
      `${offer.contingencies.length} contingencies — more ways the buyer can walk.`,
    );

  if (offer.closeDays && offer.closeDays <= 25)
    pros.push(`Closes in ${offer.closeDays} days — quick.`);
  else if (offer.closeDays && offer.closeDays >= 40)
    cons.push(`${offer.closeDays}-day close — that's a long window.`);

  if (offer.proofOfFunds && (cash || offer.preApproval))
    pros.push("Funds and approval are documented.");
  if (!offer.proofOfFunds) cons.push("No proof of funds yet.");
  if (!cash && !offer.preApproval)
    cons.push("Missing a written pre-approval letter.");

  if (offer.concessions && offer.concessions.toLowerCase() !== "none")
    cons.push(`Asking for ${offer.concessions.toLowerCase()}.`);

  if (offer.leasebackRequest && offer.leasebackRequest.toLowerCase() !== "none")
    pros.push(`Open to a leaseback (${offer.leasebackRequest}).`);

  const closeP = scores?.closeProbability.score ?? 75;
  const headline =
    `${fmt(offer.offerPrice)} · ${cash ? "all cash" : offer.financingType.toLowerCase()} · ` +
    `${offer.closeDays || 30}-day close`;

  const what_this_means = (() => {
    if (cash && offer.contingencies.length <= 1)
      return `${offer.buyerName} is offering ${fmt(offer.offerPrice)} (${aboveStr}) in cash with very few strings attached. In plain English: this is a clean, quick deal. The biggest reason it might fall apart is small.`;
    if (offer.contingencies.length >= 3 || (offer.closeDays || 0) >= 40)
      return `${offer.buyerName} brings ${fmt(offer.offerPrice)} (${aboveStr}) — but the deal has ${offer.contingencies.length} contingencies and a ${offer.closeDays || 30}-day window. The price is appealing; the catch is the buyer keeps a few exit ramps.`;
    return `${offer.buyerName} is offering ${fmt(offer.offerPrice)} (${aboveStr}) ${cash ? "in cash" : `with ${offer.downPaymentPercent}% down`}, closing in ${offer.closeDays || 30} days. A solid, balanced offer — strong on price and reasonable on terms.`;
  })();

  const risk_note =
    closeP >= 88
      ? "Very likely to close. Low risk of surprises."
      : closeP >= 78
      ? "Likely to close, but worth tightening a couple of terms."
      : closeP >= 68
      ? "Some real execution risk — moveable with the right counter."
      : "High risk of falling through. Treat the price as conditional.";

  const fit = Math.round(
    (scores?.offerStrength.score ?? 70) * 0.35 +
      (scores?.closeProbability.score ?? 75) * 0.35 +
      (scores?.financialConfidence.score ?? 75) * 0.2 +
      (100 - (scores?.contingencyRisk.score ?? 30)) * 0.1,
  );

  return {
    offer,
    scores,
    labels: [],
    headline,
    what_this_means,
    pros: pros.slice(0, 4),
    cons: cons.slice(0, 3),
    risk_note,
    fit,
  };
}

function assignLabels(cards: SellerOfferCard[]): void {
  if (cards.length === 0) return;

  const highest = cards.reduce((a, b) =>
    b.offer.offerPrice > a.offer.offerPrice ? b : a,
  );
  highest.labels.push("Highest");

  const safest = cards.reduce((a, b) =>
    (b.scores?.closeProbability.score ?? 0) >
    (a.scores?.closeProbability.score ?? 0)
      ? b
      : a,
  );
  if (!safest.labels.includes("Highest")) safest.labels.push("Safest");
  else safest.labels.push("Safest");

  const cleanest = cards.reduce((a, b) =>
    b.offer.contingencies.length < a.offer.contingencies.length ? b : a,
  );
  cleanest.labels.push("Cleanest");

  const balance = cards.reduce((a, b) => (b.fit > a.fit ? b : a));
  balance.labels.push("Best Balance");

  const fastest = cards.reduce((a, b) =>
    (b.offer.closeDays || 999) < (a.offer.closeDays || 999) ? b : a,
  );
  fastest.labels.push("Fastest Close");

  const strongestFin = cards.reduce((a, b) =>
    (b.scores?.financialConfidence.score ?? 0) >
    (a.scores?.financialConfidence.score ?? 0)
      ? b
      : a,
  );
  if (!strongestFin.labels.includes("Highest"))
    strongestFin.labels.push("Strongest Financials");

  // Dedupe while preserving order
  for (const c of cards) {
    c.labels = Array.from(new Set(c.labels));
  }
}

function buildTradeoffs(
  cards: SellerOfferCard[],
  report: RecommendationReport,
): SellerTradeoff[] {
  const byId = new Map(cards.map((c) => [c.offer.id, c]));
  const top = byId.get(report.best_overall.offer_id);
  const high = byId.get(report.highest.offer_id);
  const safe = byId.get(report.safest.offer_id);

  const out: SellerTradeoff[] = [];

  if (high && top && high.offer.id !== top.offer.id) {
    out.push({
      title: "Bigger number vs. cleaner deal",
      body: `${high.offer.buyerName} put the highest price on the table at ${fmt(
        high.offer.offerPrice,
      )}, but ${top.offer.buyerName}'s offer is structurally stronger at ${fmt(
        top.offer.offerPrice,
      )}. The gap is roughly ${fmt(
        high.offer.offerPrice - top.offer.offerPrice,
      )} — and you're trading that for fewer ways the deal can slip.`,
    });
  }

  if (safe && top && safe.offer.id !== top.offer.id) {
    out.push({
      title: "Best overall vs. surest thing",
      body: `${top.offer.buyerName} is the strongest all-around offer, but if certainty is the main thing on your mind, ${safe.offer.buyerName} is the buyer most likely to actually make it to the closing table. The price is close; the confidence is higher.`,
    });
  }

  out.push({
    title: "Speed vs. price",
    body: "Faster closes usually come from buyers who are paying cash or pre-approved. They tend to feel sure — and they often expect a small price concession in exchange for that certainty. Both are valid; it depends on what matters more to you.",
  });

  return out.slice(0, 3);
}

function buildComparison(cards: SellerOfferCard[]): ComparisonRow[] {
  const f = (n: number) => fmt(n);
  return [
    { label: "Buyer", values: cards.map((c) => c.offer.buyerName) },
    { label: "Offer Price", values: cards.map((c) => f(c.offer.offerPrice)) },
    {
      label: "Financing",
      values: cards.map((c) =>
        isCash(c.offer)
          ? "All cash"
          : `${c.offer.downPaymentPercent}% down · ${c.offer.financingType}`,
      ),
    },
    {
      label: "Earnest Money",
      values: cards.map((c) => f(c.offer.earnestMoney)),
    },
    {
      label: "Contingencies",
      values: cards.map((c) =>
        c.offer.contingencies.length === 0
          ? "None"
          : c.offer.contingencies.join(", "),
      ),
    },
    {
      label: "Close Timeline",
      values: cards.map((c) => `${c.offer.closeDays || 30} days`),
    },
    {
      label: "Leaseback",
      values: cards.map((c) => c.offer.leasebackRequest || "None"),
    },
    {
      label: "Concessions",
      values: cards.map((c) => c.offer.concessions || "None"),
    },
    {
      label: "Verified Funds",
      values: cards.map((c) => (c.offer.proofOfFunds ? "Yes" : "Pending")),
    },
    {
      label: "Likelihood to Close",
      values: cards.map(
        (c) => `${c.scores?.closeProbability.score ?? 75}%`,
      ),
    },
  ];
}

function buildExecSummary(
  report: RecommendationReport,
  cards: SellerOfferCard[],
  listingPrice: number,
): string {
  const highest = cards.find((c) => c.offer.id === report.highest.offer_id);
  const top = cards.find((c) => c.offer.id === report.best_overall.offer_id);
  if (!top || !highest) return report.bottom_line;
  const above = listingPrice
    ? Math.round(((highest.offer.offerPrice - listingPrice) / listingPrice) * 100)
    : 0;
  return `You have ${cards.length} offers in hand${
    listingPrice ? `, with the highest sitting ${above}% above asking` : ""
  }. The strongest all-around deal is ${top.offer.buyerName} at ${fmt(
    top.offer.offerPrice,
  )} — strong on both price and the things that make a deal actually close. The biggest number on the table is ${highest.offer.buyerName} at ${fmt(
    highest.offer.offerPrice,
  )}, which is worth taking seriously even if it carries a little more execution risk.`;
}

function buildBottomLineForSeller(
  cards: SellerOfferCard[],
  report: RecommendationReport,
): string {
  const top = cards.find((c) => c.offer.id === report.best_overall.offer_id);
  if (!top) return report.bottom_line;
  return `In plain English: ${top.offer.buyerName} is the offer to take seriously first. ${top.what_this_means} We'd recommend countering on terms — not chasing the highest price unless that buyer is willing to give up some of the safety net they've built in.`;
}

export interface BuildSellerPresentationCtx {
  property: {
    address: string;
    city?: string;
    listing_price: number;
    agent_name?: string;
    agent_brokerage?: string;
  };
  offers: Offer[];
  scores: Record<string, ScoredOffer | undefined>;
  leverage: LeverageSuggestion[];
  strategies: CounterStrategy[];
  priorities?: SellerPriorityWeights | null;
  sellerGoals?: string[];
}

export function buildSellerPresentation(
  ctx: BuildSellerPresentationCtx,
): SellerPresentation {
  const report = generateRecommendationReport({
    offers: ctx.offers,
    scores: ctx.scores,
    leverage: ctx.leverage,
    strategies: ctx.strategies,
    priorities: ctx.priorities ?? null,
    listingPrice: ctx.property.listing_price,
    sellerGoals: ctx.sellerGoals,
  });

  const cards = ctx.offers.map((o) =>
    buildCard(o, ctx.scores[o.id], ctx.property.listing_price),
  );
  assignLabels(cards);

  const byId = new Map(cards.map((c) => [c.offer.id, c]));
  const overview: SellerOverview = {
    total_offers: cards.length,
    top_recommendation: {
      buyer: report.best_overall.buyer_name,
      price: report.best_overall.offer_price,
      reason: byId.get(report.best_overall.offer_id)?.what_this_means ?? "",
    },
    highest: {
      buyer: report.highest.buyer_name,
      price: report.highest.offer_price,
      reason: report.highest.explanation,
    },
    safest: {
      buyer: report.safest.buyer_name,
      price: report.safest.offer_price,
      reason: report.safest.explanation,
    },
    best_balance: {
      buyer: report.best_fit.buyer_name,
      price: report.best_fit.offer_price,
      reason: report.best_fit.explanation,
    },
  };

  return {
    property: {
      ...ctx.property,
      prepared_on: new Date().toISOString(),
    },
    overview,
    executive_summary: buildExecSummary(report, cards, ctx.property.listing_price),
    priority_summary: priorityLabels(ctx.priorities),
    cards,
    tradeoffs: buildTradeoffs(cards, report),
    comparison_rows: buildComparison(cards),
    report,
    bottom_line_for_seller: buildBottomLineForSeller(cards, report),
  };
}

export const formatCurrencySeller = fmt;