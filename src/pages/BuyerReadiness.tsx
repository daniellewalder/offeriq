import AppLayout from '@/components/AppLayout';
import { CheckCircle, AlertTriangle, XCircle, Upload, ArrowRight } from 'lucide-react';

const checklistItems = [
  { label: 'Purchase Agreement', status: 'complete' as const, note: 'Looks good — all the key fields are filled in, price and terms are clear, and signatures are present. Nothing to flag here.' },
  { label: 'Pre-Approval Letter', status: 'warning' as const, note: 'This letter is 45 days old, and most listing agents in this market will notice. Get an updated one dated within the last week — it takes a single phone call to your lender and it removes any question about whether the financing is still solid.' },
  { label: 'Proof of Funds', status: 'complete' as const, note: 'Chase Private Client statement from two weeks ago showing sufficient funds. This is exactly what a listing agent wants to see — recent, from a recognized institution, with clear numbers.' },
  { label: 'Proof of Income', status: 'complete' as const, note: 'Two years of W-2s and tax returns included. This tells the seller\'s side that your lender has real documentation to work with, not just a verbal pre-qual.' },
  { label: 'Earnest Money Commitment', status: 'warning' as const, note: 'At $150K, this is on the low side for a $9M property. In competitive situations, listing agents read the deposit as a signal of how serious you are. Moving to $200K–$250K would put you in line with the strongest offers and doesn\'t change your actual risk — the money comes back at close.' },
  { label: 'Buyer Cover Letter', status: 'missing' as const, note: 'Not every agent cares about these, but when you\'re competing against four or five other offers, a short, genuine letter can be the tiebreaker. Keep it professional — mention why this specific property matters, not your life story.' },
  { label: 'Contingency Terms', status: 'warning' as const, note: 'A 17-day inspection period is longer than what the competing offers are likely to submit. In this market, 7–10 days is the norm for a well-maintained luxury property. Shortening this tells the seller you\'re not planning to use the inspection as a renegotiation tool.' },
  { label: 'Appraisal Gap Coverage', status: 'missing' as const, note: 'This is the single most impactful addition you could make. In luxury markets, appraisals often come in below contract price simply because comparable sales data is thin. Offering $150K–$200K in gap coverage removes the seller\'s biggest concern about financed offers.' },
  { label: 'Close Timeline', status: 'complete' as const, note: 'Thirty days is well-calibrated for this market. It gives your lender enough runway without making the seller feel like they\'re waiting around. Good instinct here.' },
  { label: 'Disclosures Acknowledgment', status: 'complete' as const, note: 'All seller disclosures reviewed and acknowledged. This is a small detail that signals professionalism — a surprising number of offers come in without this step completed.' },
];

const statusIcon = { complete: CheckCircle, warning: AlertTriangle, missing: XCircle };
const statusColor = { complete: 'text-success', warning: 'text-warning', missing: 'text-destructive' };
const statusBg = { complete: 'bg-success/5 border-success/20', warning: 'bg-warning/5 border-warning/20', missing: 'bg-destructive/5 border-destructive/20' };

const completeCount = checklistItems.filter(i => i.status === 'complete').length;
const confidenceScore = Math.round((completeCount / checklistItems.length) * 100 - checklistItems.filter(i => i.status === 'missing').length * 5);

export default function BuyerReadiness() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Readiness</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Buyer Offer Readiness</h1>
        </div>

        {/* Upload area */}
        <div className="card-elevated p-6">
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-gold/40 transition-colors cursor-pointer">
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium font-body mb-1">Upload Your Offer Package</p>
            <p className="text-xs text-muted-foreground font-body">Drop all documents for AI review</p>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="card-elevated p-6 flex items-center gap-6">
          <div className={`score-ring text-lg border-2 ${confidenceScore >= 80 ? 'border-success text-success' : confidenceScore >= 60 ? 'border-warning text-warning' : 'border-destructive text-destructive'}`}>
            {confidenceScore}
          </div>
          <div>
            <h3 className="text-base font-semibold font-body">Submission Confidence Score</h3>
            <p className="text-sm text-muted-foreground font-body">
              {completeCount} of {checklistItems.length} items complete. {checklistItems.filter(i => i.status === 'missing').length} items missing, {checklistItems.filter(i => i.status === 'warning').length} items need attention.
            </p>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-3">
          {checklistItems.map((item) => {
            const Icon = statusIcon[item.status];
            return (
              <div key={item.label} className={`card-elevated p-4 border ${statusBg[item.status]}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${statusColor[item.status]}`} />
                  <div>
                    <p className="text-sm font-semibold font-body">{item.label}</p>
                    <p className="text-sm text-muted-foreground font-body mt-0.5 leading-relaxed">{item.note}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recommendations */}
        <div className="card-elevated p-6">
          <h3 className="heading-display text-lg font-semibold mb-3">What Would Make This Offer Harder to Say No To</h3>
          <ul className="space-y-2">
            {[
              'Get a fresh pre-approval letter — the current one is stale and a sharp listing agent will use it to question your financing.',
              'Bump the earnest money to $200K+. It\'s the easiest way to signal conviction, and you get it back at close anyway.',
              'Add $150K–$200K in appraisal gap coverage. This is what separates good offers from winning offers in luxury markets where comps are sparse.',
              'Write a brief, genuine cover letter. You\'re competing against trusts and LLCs — a real person with a real connection to the property stands out.',
              'Shorten the inspection to 10 days. Seventeen days reads as "I\'m going to find reasons to renegotiate." Ten days reads as "I\'m committed."',
            ].map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm font-body">
                <ArrowRight className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}