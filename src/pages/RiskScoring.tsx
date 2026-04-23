import AppLayout from '@/components/AppLayout';
import { sampleProperty, getScoreColor, getScoreBg, getRiskColor } from '@/data/sampleData';

const scoreExplanations: Record<string, Record<string, string>> = {
  'offer-a': {
    offerStrength: 'This is the strongest offer in the pool. All-cash at $350K over asking with essentially one contingency — that\'s a seller\'s dream on paper. Hard to find a cleaner combination of price and certainty.',
    closeProbability: 'With verified cash from JPMorgan Private Bank and only a 7-day inspection window, there are very few ways this deal falls apart. If the property shows well during inspection, this closes.',
    financialConfidence: 'JPMorgan Private Bank doesn\'t put their name on verification letters lightly. Full proof of funds, no lending dependency. This buyer can write a check tomorrow.',
    contingencyRisk: 'A 7-day inspection is essentially a formality for a buyer at this level. There\'s almost no window for renegotiation here, which is exactly what you want.',
    timingRisk: 'Twenty-one days is tight, but for an all-cash deal with a motivated buyer relocating from overseas, it\'s actually quite doable. No lender timeline to worry about.',
    packageCompleteness: 'The only missing piece is a personal buyer verification, which is standard for trust-held purchases. Everything else checks out — funds, agreement, agent credentials.',
  },
  'offer-b': {
    offerStrength: 'The Chens put together the most thorough, well-prepared offer in this group. It\'s not the highest price, but the completeness of the package tells you these buyers are serious and their agent knows what they\'re doing.',
    closeProbability: 'First Republic pre-approval with documented income and assets — this is about as bankable as a financed offer gets. The 30-day timeline gives plenty of room for underwriting without any rush.',
    financialConfidence: 'Pre-approved with full income documentation, tax returns, and asset verification. First Republic is conservative with their pre-approvals, so when they say yes, they mean it.',
    contingencyRisk: 'Standard inspection and appraisal contingencies are the tradeoff for a financed offer. They\'re manageable — this isn\'t a buyer who\'s going to nitpick the inspection report.',
    timingRisk: 'Thirty days is the sweet spot for this market. It aligns with what sellers in Bel Air typically expect, and it gives everyone room to handle the paperwork without drama.',
    packageCompleteness: 'This is the gold standard. Every document present, every field filled, every signature in place. If you\'re evaluating professionalism, this is the offer that sets the bar.',
  },
  'offer-c': {
    offerStrength: 'Westside Holdings is playing the speed card — 14-day close, all cash, but they\'re asking for $150K below list plus a $50K concession. The math works in their favor, not yours. Speed is the only real selling point here.',
    closeProbability: 'The cash is real — Goldman Sachs doesn\'t issue proof-of-funds letters casually. But the LLC structure adds a layer of complexity. Until that operating agreement is reviewed, there\'s an open question about who exactly is on the other side of this deal.',
    financialConfidence: 'Goldman Sachs-backed funds are about as solid as it gets, but entity purchases require more diligence. The money is there; the question is whether the entity structure introduces any title or closing complications.',
    contingencyRisk: 'A 14-day inspection paired with a concession request is a negotiation play — they want to get in, find issues, and use them to push the price down further. Worth being eyes-open about that.',
    timingRisk: 'Fourteen days is the fastest close in this group, but it requires you to move quickly on review and response. If you\'re not ready to turn things around in 48 hours, this timeline works against you.',
    packageCompleteness: 'The LLC operating agreement is still outstanding, and that\'s not a small gap. For an entity purchase at this price point, you need to see exactly who the principals are before moving forward.',
  },
  'offer-d': {
    offerStrength: 'On paper, $9.25M is the number you want to see. But peel it back and you\'ve got three contingencies, a 45-day close, and a leaseback request. The headline price is doing a lot of heavy lifting to offset real execution risk.',
    closeProbability: 'Three contingencies and a 45-day runway create multiple off-ramps for this buyer. Any one of the inspection, appraisal, or loan contingencies could unwind the deal. This is a high-risk, high-reward path.',
    financialConfidence: 'Wells Fargo Private pre-approval is credible, but jumbo loans at this price point go through serious underwriting scrutiny. The 30% down helps, but there\'s still lender risk that doesn\'t exist with cash offers.',
    contingencyRisk: 'This is the riskiest offer in the pool from a contingency standpoint. Inspection, appraisal, and loan — that\'s three separate windows where the buyer can walk or renegotiate. You\'re essentially giving them 45 days of optionality.',
    timingRisk: 'Forty-five days plus a 30-day leaseback means you\'re looking at 75 days of total exposure. In a market that can shift quickly, that\'s a long time to be under contract with an uncertain outcome.',
    packageCompleteness: 'The leaseback addendum is still pending, and that\'s a conversation that needs to happen before you can properly evaluate the true cost of this offer. Everything else looks reasonable.',
  },
  'offer-e': {
    offerStrength: 'The Kapoors brought something none of the other financed buyers did — appraisal gap coverage. That one detail tells you a lot about how much they want this house and how well their agent prepared them.',
    closeProbability: 'Chase Private Client backing with explicit gap coverage removes the most common failure point for financed offers in luxury markets. If the appraisal comes in low, they\'ve already committed to covering the difference.',
    financialConfidence: 'Twenty-five percent down through Chase Private Client with full documentation. This is a well-capitalized buyer who isn\'t stretching to make this work.',
    contingencyRisk: 'Standard contingencies on paper, but the appraisal gap coverage fundamentally changes the risk calculus. The biggest concern with financed offers — a low appraisal blowing up the deal — is off the table here.',
    timingRisk: 'Twenty-eight days is comfortable and realistic. Not so fast that things get sloppy, not so slow that you\'re exposed to market shifts. A well-calibrated timeline.',
    packageCompleteness: 'Complete package, all key documents verified. The Kapoors and their agent clearly came prepared to compete — everything is buttoned up.',
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
        <div className="mb-2">
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Risk Analysis</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Quality & Risk Scoring</h1>
        </div>

        {sampleProperty.offers.map((offer) => (
          <div key={offer.id} className="card-elevated p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="heading-display text-xl">{offer.buyerName}</h3>
                <p className="text-[11px] text-muted-foreground font-body mt-1 tracking-wide">{offer.agentName} · {offer.agentBrokerage}</p>
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
                  <div key={s.key} className={`p-4 rounded-md border ${bgClass}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-medium text-muted-foreground font-body tracking-[0.1em] uppercase">{s.label}</span>
                      <span className={`text-lg font-light font-display ${colorClass}`}>
                        {s.isRisk ? `${value}%` : `${value}/100`}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground font-body leading-relaxed">{explanation}</p>
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