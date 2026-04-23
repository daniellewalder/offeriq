import AppLayout from '@/components/AppLayout';
import { Target, TrendingUp, Shield, Scale, RefreshCw, FileText } from 'lucide-react';

const strategies = [
  {
    title: 'Maximize Price',
    icon: TrendingUp,
    color: 'bg-gold-light text-gold',
    counterPrice: '$9,050,000',
    timeline: '25 days',
    contingencyChanges: 'Reduce inspection to 5 days, waive appraisal contingency',
    leasebackPosition: '7-day rent-free leaseback granted',
    deposit: '$300,000 earnest money required',
    docRequests: 'Updated proof of funds within 48 hours',
    rationale: 'Counter Offer A (Nakamura Trust) at $9.05M — a modest reduction from their $9.1M all-cash offer in exchange for shortened inspection and faster close. The buyer\'s strong cash position and relocation urgency support acceptance at near-full price.',
  },
  {
    title: 'Maximize Certainty',
    icon: Shield,
    color: 'bg-success/10 text-success',
    counterPrice: '$8,850,000',
    timeline: '28 days',
    contingencyChanges: 'Accept standard inspection (10 days), require appraisal gap coverage up to $200K',
    leasebackPosition: '14-day rent-free leaseback',
    deposit: '$250,000 earnest money',
    docRequests: 'None — package is complete',
    rationale: 'Counter Offer B (Chen) with full package completeness. First Republic pre-approval and documented income provide highest certainty of close. Moderate price reduction compensated by deal security.',
  },
  {
    title: 'Best Balance',
    icon: Scale,
    color: 'bg-info/10 text-info',
    counterPrice: '$8,950,000',
    timeline: '28 days',
    contingencyChanges: 'Reduce inspection to 7 days, maintain appraisal gap coverage',
    leasebackPosition: '10-day rent-free leaseback',
    deposit: '$275,000 earnest money',
    docRequests: 'Verification of appraisal gap commitment',
    rationale: 'Hybrid approach targeting Offer E (Kapoor) — combines strong financial backing and appraisal gap coverage with a price bump. The Kapoors\' flexibility on terms makes this a high-probability acceptance.',
  },
];

export default function CounterStrategy() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="heading-display text-2xl lg:text-3xl font-semibold mb-1">Counter Strategy Builder</h1>
          <p className="text-muted-foreground font-body text-sm">Three AI-generated counteroffer strategies based on seller priorities and offer analysis.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {strategies.map((s, i) => (
            <div key={i} className={`card-elevated p-6 space-y-4 ${i === 2 ? 'ring-2 ring-gold/30' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold font-body">{s.title}</h3>
                  {i === 2 && <span className="badge-gold text-xs">Recommended</span>}
                </div>
              </div>

              <div className="space-y-3">
                {[
                  ['Counter Price', s.counterPrice],
                  ['Timeline', s.timeline],
                  ['Contingency Changes', s.contingencyChanges],
                  ['Leaseback', s.leasebackPosition],
                  ['Deposit', s.deposit],
                  ['Doc Requests', s.docRequests],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-xs text-muted-foreground font-body">{label}</p>
                    <p className="text-sm font-medium font-body">{value}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground font-body italic leading-relaxed">{s.rationale}</p>
              </div>

              <div className="flex gap-2 pt-1">
                <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium font-body hover:opacity-90 transition-opacity">
                  <RefreshCw className="w-3.5 h-3.5" /> Revise
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium font-body hover:bg-muted transition-colors">
                  <FileText className="w-3.5 h-3.5" /> Summary
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}