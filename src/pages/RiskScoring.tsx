import AppLayout from '@/components/AppLayout';
import { sampleProperty, getScoreColor, getScoreBg, getRiskColor } from '@/data/sampleData';

const scoreExplanations: Record<string, Record<string, string>> = {
  'offer-a': {
    offerStrength: 'All-cash offer at $350K over asking with minimal contingencies. Exceptionally competitive.',
    closeProbability: 'Cash buyer with verified funds and minimal contingencies. Very high likelihood of successful close.',
    financialConfidence: 'JPMorgan Private Bank verification with full proof of funds. Top-tier financial backing.',
    contingencyRisk: 'Only a 7-day inspection contingency. Minimal risk of deal falling through due to contingencies.',
    timingRisk: '21-day close is aggressive but achievable for cash transactions. Low risk.',
    packageCompleteness: 'Missing only buyer personal verification. Near-complete package.',
  },
  'offer-b': {
    offerStrength: 'Strong conventional offer with complete documentation. Well-positioned for a smooth close.',
    closeProbability: 'First Republic pre-approval with clean financials. High confidence in loan approval.',
    financialConfidence: 'Pre-approved with documented income and assets. Solid financial profile.',
    contingencyRisk: 'Standard inspection and appraisal contingencies. Moderate but manageable risk.',
    timingRisk: '30-day timeline aligns with seller preference. Well-calibrated.',
    packageCompleteness: 'All documents present and verified. Best package completeness among all offers.',
  },
  'offer-c': {
    offerStrength: 'Cash offer below asking with concession request. Speed is the primary advantage.',
    closeProbability: 'LLC structure introduces verification complexity. Proof of funds is strong.',
    financialConfidence: 'Goldman Sachs-backed funds but LLC operating agreement needs review.',
    contingencyRisk: '14-day inspection with concession request adds negotiation risk.',
    timingRisk: '14-day close is fastest but requires swift seller response.',
    packageCompleteness: 'LLC operating agreement pending review. Key documentation gap.',
  },
  'offer-d': {
    offerStrength: 'Highest price but heavily contingent. Risk-reward trade-off is unfavorable.',
    closeProbability: 'Three contingencies and 45-day close create multiple failure points.',
    financialConfidence: 'Pre-approved but jumbo loan introduces underwriting risk.',
    contingencyRisk: 'Inspection, appraisal, and loan contingencies. Highest contingency risk.',
    timingRisk: '45-day timeline with leaseback. Longest overall duration.',
    packageCompleteness: 'Leaseback addendum still pending. Needs attention.',
  },
  'offer-e': {
    offerStrength: 'Well-balanced offer with appraisal gap coverage. Competitive without being aggressive.',
    closeProbability: 'Chase Private Client backing with gap coverage reduces appraisal risk significantly.',
    financialConfidence: 'Strong documentation with 25% down payment. Reliable financial profile.',
    contingencyRisk: 'Standard contingencies offset by appraisal gap coverage.',
    timingRisk: '28-day close is reasonable and achievable.',
    packageCompleteness: 'Complete package with all key documents verified.',
  },
};

const scoreLabels = [
  { key: 'offerStrength' as const, label: 'Offer Strength', isRisk: false },
  { key: 'closeProbability' as const, label: 'Close Probability', isRisk: false },
  { key: 'financialConfidence' as const, label: 'Financial Confidence', isRisk: false },
  { key: 'contingencyRisk' as const, label: 'Contingency Risk', isRisk: true },
  { key: 'timingRisk' as const, label: 'Timing Risk', isRisk: true },
  { key: 'packageCompleteness' as const, label: 'Package Completeness', isRisk: false },
];

export default function RiskScoring() {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="heading-display text-2xl lg:text-3xl font-semibold mb-1">Risk & Quality Scoring</h1>
          <p className="text-muted-foreground font-body text-sm">Comprehensive scoring with plain-language explanations for each offer.</p>
        </div>

        {sampleProperty.offers.map((offer) => (
          <div key={offer.id} className="card-elevated p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold font-body">{offer.buyerName}</h3>
                <p className="text-xs text-muted-foreground font-body">{offer.agentName} · {offer.agentBrokerage}</p>
              </div>
              <div className="flex gap-1.5">
                {offer.labels.map(l => <span key={l} className="badge-gold text-xs">{l}</span>)}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {scoreLabels.map((s) => {
                const value = offer.scores[s.key];
                const colorClass = s.isRisk ? getRiskColor(value) : getScoreColor(value);
                const bgClass = s.isRisk
                  ? (value <= 20 ? 'bg-success/5 border-success/20' : value <= 40 ? 'bg-warning/5 border-warning/20' : 'bg-destructive/5 border-destructive/20')
                  : getScoreBg(value);
                const explanation = scoreExplanations[offer.id]?.[s.key] ?? '';

                return (
                  <div key={s.key} className={`p-4 rounded-xl border ${bgClass}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground font-body">{s.label}</span>
                      <span className={`text-lg font-semibold font-body ${colorClass}`}>
                        {s.isRisk ? `${value}%` : `${value}/100`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-body leading-relaxed">{explanation}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}