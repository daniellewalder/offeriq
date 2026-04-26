import type { Offer, FieldEvidence } from '@/data/sampleData';

export interface ScoreDetail {
  score: number;
  factors: ScoreFactor[];
  summary: string;
}

export interface ScoreFactor {
  label: string;
  impact: number;
  explanation: string;
  /** Optional document evidence backing this factor */
  source?: {
    documentName: string | null;
    quote: string | null;
    confidence: number;
    fieldKey: string;
  };
}

export interface ScoredOffer {
  offerStrength: ScoreDetail;
  closeProbability: ScoreDetail;
  financialConfidence: ScoreDetail;
  contingencyRisk: ScoreDetail;
  timingRisk: ScoreDetail;
  packageCompleteness: ScoreDetail;
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(v)));

/** Pull the evidence record for a given extracted-field key from the offer. */
function srcOf(offer: Offer, key: string): ScoreFactor['source'] | undefined {
  const e: FieldEvidence | undefined = offer.evidence?.[key];
  if (!e) return undefined;
  return {
    documentName: e.documentName,
    quote: e.quote,
    confidence: e.confidence,
    fieldKey: key,
  };
}

export function computeScores(offer: Offer, listingPrice: number): ScoredOffer {
  // ─── Offer Strength ───
  const priceRatio = offer.offerPrice / listingPrice;
  const strengthFactors: ScoreDetail['factors'] = [];
  let strength = 50;

  if (priceRatio >= 1.04) {
    strength += 25;
    strengthFactors.push({ label: 'Price premium', impact: 25, explanation: `${((priceRatio - 1) * 100).toFixed(1)}% over asking — that's a strong signal of serious intent.`, source: srcOf(offer, 'offer_price') });
  } else if (priceRatio >= 1.0) {
    const bump = Math.round((priceRatio - 1) * 500);
    strength += bump;
    strengthFactors.push({ label: 'At or above asking', impact: bump, explanation: `Offer is at ${((priceRatio - 1) * 100).toFixed(1)}% over list — solid but not a stretch.`, source: srcOf(offer, 'offer_price') });
  } else {
    const penalty = Math.round((1 - priceRatio) * 300);
    strength -= penalty;
    strengthFactors.push({ label: 'Below asking', impact: -penalty, explanation: `Coming in ${((1 - priceRatio) * 100).toFixed(1)}% under list reduces competitiveness.`, source: srcOf(offer, 'offer_price') });
  }

  if (offer.financingType.toLowerCase().includes('cash')) {
    strength += 15;
    strengthFactors.push({ label: 'All-cash offer', impact: 15, explanation: 'No financing dependency — eliminates lender risk entirely.', source: srcOf(offer, 'financing_type') });
  } else if (offer.downPaymentPercent >= 25) {
    strength += 8;
    strengthFactors.push({ label: 'Strong down payment', impact: 8, explanation: `${offer.downPaymentPercent}% down shows financial depth and reduces lender exposure.`, source: srcOf(offer, 'down_payment_percent') });
  }

  if (offer.contingencies.length === 0) {
    strength += 10;
    strengthFactors.push({ label: 'No contingencies', impact: 10, explanation: 'Clean offer with no contingency off-ramps.' });
  } else if (offer.contingencies.length === 1) {
    strength += 5;
    strengthFactors.push({ label: 'Minimal contingencies', impact: 5, explanation: 'Only one contingency — relatively clean.' });
  } else if (offer.contingencies.length >= 3) {
    strength -= 10;
    strengthFactors.push({ label: 'Multiple contingencies', impact: -10, explanation: `${offer.contingencies.length} contingencies create multiple exit points for the buyer.` });
  }

  if (offer.concessions && offer.concessions !== 'None') {
    strength -= 8;
    strengthFactors.push({ label: 'Concession requests', impact: -8, explanation: `Asking for concessions (${offer.concessions}) weakens the net offer.`, source: srcOf(offer, 'concessions_requested') });
  }

  const earnestPct = (offer.earnestMoney / offer.offerPrice) * 100;
  if (earnestPct >= 3) {
    strength += 5;
    strengthFactors.push({ label: 'Strong deposit', impact: 5, explanation: `${earnestPct.toFixed(1)}% earnest money shows real commitment.`, source: srcOf(offer, 'earnest_money_deposit') });
  } else if (earnestPct < 2) {
    strength -= 5;
    strengthFactors.push({ label: 'Weak deposit', impact: -5, explanation: `${earnestPct.toFixed(1)}% deposit is light for this price point.`, source: srcOf(offer, 'earnest_money_deposit') });
  }

  // ─── Close Probability ───
  const closeFactors: ScoreDetail['factors'] = [];
  let close = 60;

  if (offer.financingType.toLowerCase().includes('cash')) {
    close += 20;
    closeFactors.push({ label: 'Cash purchase', impact: 20, explanation: 'No loan underwriting, no appraisal dependency — dramatically fewer failure points.', source: srcOf(offer, 'financing_type') });
  } else if (offer.preApproval) {
    close += 12;
    closeFactors.push({ label: 'Pre-approved', impact: 12, explanation: 'Lender has already vetted this buyer — significantly reduces financing risk.', source: srcOf(offer, 'preapproval_present') });
  } else {
    close -= 10;
    closeFactors.push({ label: 'No pre-approval', impact: -10, explanation: 'Without lender vetting, financing risk remains an open question.', source: srcOf(offer, 'preapproval_present') });
  }

  if (offer.proofOfFunds) {
    close += 8;
    closeFactors.push({ label: 'Proof of funds verified', impact: 8, explanation: 'Documented funds confirm the buyer can actually perform.', source: srcOf(offer, 'proof_of_funds_present') });
  } else {
    close -= 12;
    closeFactors.push({ label: 'No proof of funds', impact: -12, explanation: 'Without verified funds, closing confidence drops materially.', source: srcOf(offer, 'proof_of_funds_present') });
  }

  if (offer.contingencies.length >= 3) {
    close -= 15;
    closeFactors.push({ label: 'Three+ contingencies', impact: -15, explanation: 'Each contingency is an off-ramp — three creates compounding risk.' });
  } else if (offer.contingencies.length <= 1) {
    close += 8;
    closeFactors.push({ label: 'Clean contingency profile', impact: 8, explanation: `Only ${offer.contingencies.length} contingency — fewer ways for this deal to unwind.` });
  }

  if (offer.appraisalTerms.toLowerCase().includes('gap coverage') || offer.appraisalTerms.toLowerCase().includes('waived')) {
    close += 8;
    closeFactors.push({ label: 'Appraisal protection', impact: 8, explanation: 'Appraisal gap coverage or waiver eliminates the #1 financed-deal killer.' });
  }

  if (offer.closeDays <= 21) {
    close += 5;
    closeFactors.push({ label: 'Fast close', impact: 5, explanation: 'Shorter timeline means less exposure to market shifts or buyer cold feet.', source: srcOf(offer, 'close_of_escrow_days') });
  } else if (offer.closeDays >= 45) {
    close -= 8;
    closeFactors.push({ label: 'Extended timeline', impact: -8, explanation: `${offer.closeDays} days is a long exposure window — market conditions or buyer circumstances can change.`, source: srcOf(offer, 'close_of_escrow_days') });
  }

  // ─── Financial Confidence ───
  const finFactors: ScoreDetail['factors'] = [];
  let financial = 50;

  if (offer.proofOfFunds) {
    financial += 20;
    finFactors.push({ label: 'Proof of funds present', impact: 20, explanation: 'Verified funds are the foundation of financial credibility.', source: srcOf(offer, 'proof_of_funds_present') });
  } else {
    financial -= 20;
    finFactors.push({ label: 'Missing proof of funds', impact: -20, explanation: 'No verified funds — this is a serious gap that listing agents notice immediately.', source: srcOf(offer, 'proof_of_funds_present') });
  }

  if (offer.financingType.toLowerCase().includes('cash')) {
    financial += 25;
    finFactors.push({ label: 'All-cash buyer', impact: 25, explanation: 'No lending dependency — the strongest possible financial position.', source: srcOf(offer, 'financing_type') });
  } else if (offer.preApproval) {
    financial += 15;
    finFactors.push({ label: 'Lender pre-approval', impact: 15, explanation: 'A reputable lender has already underwritten this buyer.', source: srcOf(offer, 'preapproval_present') });
  } else {
    financial -= 15;
    finFactors.push({ label: 'No pre-approval', impact: -15, explanation: 'Without lender confirmation, the financing is speculative.', source: srcOf(offer, 'preapproval_present') });
  }

  if (offer.downPaymentPercent >= 30) {
    financial += 10;
    finFactors.push({ label: 'High down payment', impact: 10, explanation: `${offer.downPaymentPercent}% down signals the buyer isn't stretching to afford this property.`, source: srcOf(offer, 'down_payment_percent') });
  } else if (offer.downPaymentPercent >= 20) {
    financial += 5;
    finFactors.push({ label: 'Standard down payment', impact: 5, explanation: `${offer.downPaymentPercent}% down is adequate but not exceptional.`, source: srcOf(offer, 'down_payment_percent') });
  } else if (offer.downPaymentPercent < 20 && !offer.financingType.toLowerCase().includes('cash')) {
    financial -= 10;
    finFactors.push({ label: 'Low down payment', impact: -10, explanation: `${offer.downPaymentPercent}% down may signal the buyer is at their financial ceiling.`, source: srcOf(offer, 'down_payment_percent') });
  }

  // Check for document verification quality
  const verifiedDocs = offer.documents.filter(d => d.status === 'verified').length;
  const totalDocs = offer.documents.length;
  if (totalDocs > 0 && verifiedDocs === totalDocs) {
    financial += 5;
    finFactors.push({ label: 'All docs verified', impact: 5, explanation: 'Every financial document has been verified — no loose ends.' });
  } else if (totalDocs > 0) {
    const pendingDocs = offer.documents.filter(d => d.status === 'pending').length;
    if (pendingDocs > 0) {
      financial -= 5;
      finFactors.push({ label: 'Pending documents', impact: -5, explanation: `${pendingDocs} document(s) still pending review — creates uncertainty.` });
    }
  }

  // ─── Contingency Risk (higher = worse) ───
  const contFactors: ScoreDetail['factors'] = [];
  let contingencyRisk = 10;

  contingencyRisk += offer.contingencies.length * 12;
  if (offer.contingencies.length > 0) {
    contFactors.push({ label: `${offer.contingencies.length} contingencies`, impact: offer.contingencies.length * 12, explanation: `Each contingency gives the buyer a window to renegotiate or walk.` });
  } else {
    contFactors.push({ label: 'No contingencies', impact: 0, explanation: 'Clean offer — no contingency-based exit points.' });
  }

  // Parse inspection days
  const inspMatch = offer.inspectionPeriod.match(/(\d+)/);
  const inspDays = inspMatch ? parseInt(inspMatch[1]) : 0;
  if (inspDays > 14) {
    contingencyRisk += 15;
    contFactors.push({ label: 'Long inspection window', impact: 15, explanation: `${inspDays} days gives the buyer ample time to find reasons to renegotiate.` });
  } else if (inspDays > 10) {
    contingencyRisk += 8;
    contFactors.push({ label: 'Extended inspection', impact: 8, explanation: `${inspDays}-day inspection is longer than ideal — standard luxury is 7-10 days.` });
  } else if (inspDays > 0 && inspDays <= 7) {
    contFactors.push({ label: 'Tight inspection window', impact: 0, explanation: `${inspDays}-day inspection — minimal renegotiation exposure.` });
  }

  if (offer.contingencies.some(c => c.toLowerCase().includes('loan'))) {
    contingencyRisk += 10;
    contFactors.push({ label: 'Loan contingency', impact: 10, explanation: 'Loan contingency adds underwriting risk — the deal depends on final lender approval.' });
  }

  if (offer.appraisalTerms.toLowerCase().includes('gap coverage') || offer.appraisalTerms.toLowerCase().includes('waived')) {
    contingencyRisk -= 8;
    contFactors.push({ label: 'Appraisal risk mitigated', impact: -8, explanation: 'Gap coverage or appraisal waiver removes the most common deal-breaker.' });
  }

  // ─── Timing Risk (higher = worse) ───
  const timeFactors: ScoreDetail['factors'] = [];
  let timingRisk = 5;

  if (offer.closeDays <= 14) {
    timingRisk += 5;
    timeFactors.push({ label: 'Very fast close', impact: 5, explanation: `${offer.closeDays}-day close is aggressive — fast is good but leaves little margin for hiccups.` });
  } else if (offer.closeDays <= 21) {
    timeFactors.push({ label: 'Quick close', impact: 0, explanation: `${offer.closeDays}-day close is tight but achievable, especially for cash.` });
  } else if (offer.closeDays <= 30) {
    timingRisk += 8;
    timeFactors.push({ label: 'Standard timeline', impact: 8, explanation: `${offer.closeDays} days is normal but adds some market exposure.` });
  } else {
    timingRisk += 20;
    timeFactors.push({ label: 'Extended close', impact: 20, explanation: `${offer.closeDays}-day close creates significant exposure to market shifts and buyer changes of heart.` });
  }

  if (offer.leasebackRequest && offer.leasebackRequest !== 'None') {
    const lbMatch = offer.leasebackRequest.match(/(\d+)/);
    const lbDays = lbMatch ? parseInt(lbMatch[1]) : 0;
    if (lbDays > 14) {
      timingRisk += 12;
      timeFactors.push({ label: 'Long leaseback', impact: 12, explanation: `${lbDays}-day leaseback extends total transaction timeline to ${offer.closeDays + lbDays} days.` });
    } else if (lbDays > 0) {
      timingRisk += 4;
      timeFactors.push({ label: 'Short leaseback', impact: 4, explanation: `${lbDays}-day leaseback is manageable and adds minimal timeline risk.` });
    }
  }

  if (!offer.financingType.toLowerCase().includes('cash') && offer.closeDays <= 21) {
    timingRisk += 10;
    timeFactors.push({ label: 'Financed + fast close', impact: 10, explanation: 'Trying to close a financed deal in 21 days or less is ambitious — underwriting delays are common.' });
  }

  // ─── Package Completeness ───
  const pkgFactors: ScoreDetail['factors'] = [];
  let completeness = 40;

  // Core docs check
  const hasPA = offer.documents.some(d => d.category === 'Purchase Agreement');
  const hasPOF = offer.documents.some(d => d.category === 'Proof of Funds');
  const hasPreApproval = offer.documents.some(d => d.category === 'Pre-Approval');
  const hasIncome = offer.documents.some(d => d.category === 'Proof of Income');

  if (hasPA) {
    completeness += 15;
    pkgFactors.push({ label: 'Purchase agreement present', impact: 15, explanation: 'The foundational document is present and accounted for.' });
  } else {
    completeness -= 20;
    pkgFactors.push({ label: 'Missing purchase agreement', impact: -20, explanation: 'No purchase agreement — the package is fundamentally incomplete.' });
  }

  if (hasPOF) {
    completeness += 15;
    pkgFactors.push({ label: 'Proof of funds included', impact: 15, explanation: 'Financial verification is documented.' });
  } else {
    completeness -= 15;
    pkgFactors.push({ label: 'Missing proof of funds', impact: -15, explanation: 'No proof of funds — a significant credibility gap.' });
  }

  const needsPreApproval = !offer.financingType.toLowerCase().includes('cash');
  if (needsPreApproval) {
    if (hasPreApproval) {
      completeness += 15;
      pkgFactors.push({ label: 'Pre-approval letter included', impact: 15, explanation: 'Lender pre-approval is present for this financed offer.' });
    } else {
      completeness -= 15;
      pkgFactors.push({ label: 'Missing pre-approval', impact: -15, explanation: 'Financed offer without a pre-approval letter — listing agents will flag this immediately.' });
    }
  }

  if (hasIncome) {
    completeness += 8;
    pkgFactors.push({ label: 'Income documentation', impact: 8, explanation: 'Income verification adds credibility to the financial picture.' });
  }

  const pendingCount = offer.documents.filter(d => d.status === 'pending').length;
  const missingCount = offer.documents.filter(d => d.status === 'missing').length;

  if (pendingCount > 0) {
    completeness -= pendingCount * 5;
    pkgFactors.push({ label: `${pendingCount} pending document(s)`, impact: -(pendingCount * 5), explanation: 'Documents still under review create uncertainty about package quality.' });
  }
  if (missingCount > 0) {
    completeness -= missingCount * 10;
    pkgFactors.push({ label: `${missingCount} missing document(s)`, impact: -(missingCount * 10), explanation: 'Missing documents are gaps that the listing agent will notice.' });
  }

  if (verifiedDocs === totalDocs && totalDocs > 0) {
    completeness += 7;
    pkgFactors.push({ label: 'All docs verified', impact: 7, explanation: 'Every document verified — a polished, professional package.' });
  }

  // ─── Build summaries ───
  const strengthScore = clamp(strength);
  const closeScore = clamp(close);
  const finScore = clamp(financial);
  const contRiskScore = clamp(contingencyRisk);
  const timeRiskScore = clamp(timingRisk);
  const compScore = clamp(completeness);

  return {
    offerStrength: {
      score: strengthScore,
      factors: strengthFactors,
      summary: strengthScore >= 85
        ? `A compelling offer — the combination of price, terms, and structure makes this highly competitive.`
        : strengthScore >= 70
        ? `A solid offer with some room for improvement. Competitive but not dominant.`
        : `This offer has meaningful weaknesses that reduce its appeal relative to the competition.`,
    },
    closeProbability: {
      score: closeScore,
      factors: closeFactors,
      summary: closeScore >= 85
        ? `Very high confidence this deal makes it to the finish line — few failure points remain.`
        : closeScore >= 70
        ? `Good probability of closing, but there are identifiable risks that could derail it.`
        : `Significant closing risk — multiple factors could cause this deal to fall apart.`,
    },
    financialConfidence: {
      score: finScore,
      factors: finFactors,
      summary: finScore >= 85
        ? `This buyer's financial position is thoroughly documented and strong.`
        : finScore >= 70
        ? `Financials are adequate but not bulletproof — some gaps remain.`
        : `Financial documentation is incomplete or raises questions about the buyer's ability to perform.`,
    },
    contingencyRisk: {
      score: contRiskScore,
      factors: contFactors,
      summary: contRiskScore <= 20
        ? `Minimal contingency exposure — this offer gives the buyer very few ways to renegotiate or exit.`
        : contRiskScore <= 40
        ? `Moderate contingency risk — standard protections are in place but manageable.`
        : `High contingency risk — multiple exit points create significant exposure to renegotiation.`,
    },
    timingRisk: {
      score: timeRiskScore,
      factors: timeFactors,
      summary: timeRiskScore <= 15
        ? `Timeline risk is minimal — this deal is structured to move efficiently.`
        : timeRiskScore <= 30
        ? `Some timing exposure, but nothing that should derail a well-managed transaction.`
        : `Extended timeline creates meaningful exposure to market changes and buyer uncertainty.`,
    },
    packageCompleteness: {
      score: compScore,
      factors: pkgFactors,
      summary: compScore >= 90
        ? `An exceptionally well-prepared package — this buyer's agent knows what listing agents look for.`
        : compScore >= 75
        ? `A solid package with most essentials covered. Minor gaps could be cleaned up.`
        : `This package has notable gaps that weaken its presentation to the listing agent.`,
    },
  };
}