import AppLayout from '@/components/AppLayout';
import { Lightbulb, ArrowRight } from 'lucide-react';

const leveragePoints = [
  {
    title: 'Offer Rent-Free Leaseback in Exchange for Higher Price',
    description: 'A 7–14 day rent-free leaseback costs the buyer very little but signals flexibility. Use it as a sweetener to justify holding firm on price or reducing concessions.',
    tags: ['High Seller Impact', 'Low Buyer Friction', 'Likely Acceptance Booster'],
    applicableTo: ['Offer B', 'Offer E'],
  },
  {
    title: 'Request Shortened Inspection Contingency',
    description: 'Buyers with strong intent often agree to 5–7 day inspections. This reduces seller exposure to renegotiation and signals buyer commitment.',
    tags: ['High Seller Impact', 'Strong Counter Candidate'],
    applicableTo: ['Offer B', 'Offer D', 'Offer E'],
  },
  {
    title: 'Increase Earnest Money Deposit',
    description: 'Requesting $250K+ earnest money demonstrates buyer seriousness and creates stronger contractual commitment. Low friction for well-qualified buyers.',
    tags: ['High Seller Impact', 'Low Buyer Friction'],
    applicableTo: ['Offer B', 'Offer D', 'Offer E'],
  },
  {
    title: 'Counter with Flexible Close Date',
    description: 'Offering the buyer their preferred close date while holding firm on price and contingencies creates goodwill without costing the seller financially.',
    tags: ['Low Buyer Friction', 'Likely Acceptance Booster'],
    applicableTo: ['Offer A', 'Offer C'],
  },
  {
    title: 'Eliminate Repair Request Window',
    description: 'Waiving the repair negotiation window in exchange for a modest price concession protects the seller from post-inspection surprises.',
    tags: ['High Seller Impact', 'Strong Counter Candidate'],
    applicableTo: ['Offer B', 'Offer D'],
  },
  {
    title: 'Request Appraisal Gap Coverage',
    description: 'For financed offers, requesting appraisal gap coverage eliminates the risk of deal collapse due to low appraisal. Offer E already includes this — use as a model.',
    tags: ['High Seller Impact', 'Strong Counter Candidate'],
    applicableTo: ['Offer B', 'Offer D'],
  },
];

const tagColors: Record<string, string> = {
  'High Seller Impact': 'badge-gold',
  'Low Buyer Friction': 'badge-success',
  'Strong Counter Candidate': 'badge-info',
  'Likely Acceptance Booster': 'badge-warning',
};

export default function Leverage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="mb-2">
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Negotiation</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Leverage Points</h1>
        </div>

        <div className="space-y-4">
          {leveragePoints.map((lp, i) => (
            <div key={i} className="card-elevated p-6 lg:p-7 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Lightbulb className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[13px] font-medium font-body mb-1.5">{lp.title}</h3>
                  <p className="text-[13px] text-muted-foreground font-body leading-relaxed">{lp.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 ml-12">
                {lp.tags.map(t => (
                  <span key={t} className={`${tagColors[t] ?? 'badge-info'} text-xs`}>{t}</span>
                ))}
                <span className="text-xs text-muted-foreground font-body ml-2">
                  <ArrowRight className="w-3 h-3 inline mr-1" />
                  {lp.applicableTo.join(', ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}