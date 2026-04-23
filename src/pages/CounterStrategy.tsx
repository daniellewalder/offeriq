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
    rationale: 'The Nakamura Trust came in at $9.1M all-cash, which tells you they\'re serious and motivated. Countering at $9.05M — a modest $50K haircut — while tightening the inspection to 5 days is a move they\'ll likely accept. They\'re relocating from Tokyo and want this done. Offering a 7-day leaseback costs you very little and gives them one less reason to push back. This is your best shot at top dollar with a clean close.',
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
    rationale: 'If your priority is knowing this deal actually closes, the Chens are your best bet. Their package is flawless — every document in order, First Republic pre-approval, documented income. You\'re leaving about $200K on the table compared to the top-price path, but what you\'re buying is certainty. No last-minute surprises, no financing drama, no document gaps. Sometimes the smartest deal isn\'t the biggest number.',
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
    rationale: 'The Kapoors hit a sweet spot that\'s easy to overlook. They already volunteered appraisal gap coverage — that\'s rare and signals real commitment. Counter them at $8.95M with a tighter inspection window and you\'ve got a deal that\'s $200K above asking, protected against low appraisal, and backed by Chase Private Client. The 10-day leaseback gives you breathing room without overcomplicating things. This is the path where you don\'t have to choose between price and peace of mind.',
  },
];

export default function CounterStrategy() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div className="mb-2">
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Strategy</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Counter Strategies</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {strategies.map((s, i) => (
            <div key={i} className={`card-elevated p-6 lg:p-7 space-y-5 ${i === 2 ? 'border-accent/40' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-sm flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-[13px] font-medium font-body">{s.title}</h3>
                  {i === 2 && <span className="badge-gold">Recommended</span>}
                </div>
              </div>

              <div className="space-y-3.5">
                {[
                  ['Counter Price', s.counterPrice],
                  ['Timeline', s.timeline],
                  ['Contingency Changes', s.contingencyChanges],
                  ['Leaseback', s.leasebackPosition],
                  ['Deposit', s.deposit],
                  ['Doc Requests', s.docRequests],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-[10px] text-muted-foreground font-body tracking-[0.1em] uppercase mb-0.5">{label}</p>
                    <p className="text-[13px] font-body">{value}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border/60 pt-4">
                <p className="text-[12px] text-muted-foreground font-body leading-relaxed italic">{s.rationale}</p>
              </div>

              <div className="flex gap-2 pt-1">
                <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-foreground text-background rounded-sm text-[11px] font-medium font-body hover:opacity-90 transition-opacity tracking-wide">
                  <RefreshCw className="w-3 h-3" /> Revise
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-sm text-[11px] font-medium font-body hover:bg-muted/50 transition-colors tracking-wide">
                  <FileText className="w-3 h-3" /> Summary
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}