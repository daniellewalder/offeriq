import type { Offer, DocumentItem, OfferScores, FieldEvidence } from "@/data/sampleData";
import { computeScores } from "@/lib/scoringEngine";
import type { OfferWithExtraction } from "@/lib/offerService";

/**
 * Map a raw DB offer + its latest extracted fields into the
 * Offer shape consumed by the Comparison UI.
 */
export function adaptOffer(
  row: OfferWithExtraction,
  listingPrice: number,
): Offer & { missingItems: string[]; notableRisks: string[]; notableStrengths: string[] } {
  const o = row.offer;
  const f = row.fields;

  const offerPrice = Number(o.offer_price ?? f.offer_price?.value ?? 0);
  const downPaymentPercent = Number(o.down_payment_percent ?? f.down_payment_percent?.value ?? 0);
  const downPayment = Number(o.down_payment ?? f.down_payment_amount?.value ?? 0);
  const earnestMoney = Number(o.earnest_money ?? f.earnest_money_deposit?.value ?? 0);
  const closeDays = Number(o.close_days ?? f.close_of_escrow_days?.value ?? 30);

  const documents: DocumentItem[] = (row.documents ?? []).map((d: any) => ({
    name: d.name,
    category: d.category,
    status: (d.status as DocumentItem["status"]) ?? "pending",
    confidence: Number(d.confidence ?? 0),
  }));

  // Build the evidence map from extracted fields
  const evidence: Record<string, FieldEvidence> = {};
  for (const [key, val] of Object.entries(f)) {
    evidence[key] = {
      value: val.value,
      confidence: val.confidence,
      quote: val.evidence,
      documentName: val.sourceDocumentName,
    };
  }

  const partial: Offer = {
    id: o.id,
    buyerName: o.buyer_name,
    agentName: o.agent_name ?? "—",
    agentBrokerage: o.agent_brokerage ?? "—",
    offerPrice,
    financingType: o.financing_type ?? "Unknown",
    downPayment,
    downPaymentPercent,
    earnestMoney,
    contingencies: o.contingencies ?? [],
    inspectionPeriod: o.inspection_period ?? "—",
    appraisalTerms: o.appraisal_terms ?? "Standard",
    closeTimeline: o.close_timeline ?? `${closeDays} days`,
    closeDays,
    leasebackRequest: o.leaseback_request ?? "None",
    concessions: o.concessions ?? "None",
    proofOfFunds: !!o.proof_of_funds,
    preApproval: !!o.pre_approval,
    completeness: Number(o.completeness ?? 0),
    specialNotes: o.special_notes ?? "",
    documents,
    labels: o.labels ?? [],
    evidence,
    scores: {
      offerStrength: 0,
      closeProbability: 0,
      financialConfidence: 0,
      contingencyRisk: 0,
      timingRisk: 0,
      packageCompleteness: Number(o.completeness ?? 0),
    },
  };

  const computed = computeScores(partial, listingPrice);
  const scores: OfferScores = {
    offerStrength: computed.offerStrength.score,
    closeProbability: computed.closeProbability.score,
    financialConfidence: computed.financialConfidence.score,
    contingencyRisk: computed.contingencyRisk.score,
    timingRisk: computed.timingRisk.score,
    packageCompleteness: computed.packageCompleteness.score,
  };

  return {
    ...partial,
    scores,
    missingItems: row.missingItems,
    notableRisks: row.notableRisks,
    notableStrengths: row.notableStrengths,
  };
}