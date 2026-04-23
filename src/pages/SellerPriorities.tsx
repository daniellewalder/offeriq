import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { sampleProperty, formatCurrency } from '@/data/sampleData';

const priorities = [
  { key: 'price', label: 'Maximize Price', description: 'Prioritize the highest net proceeds' },
  { key: 'certainty', label: 'Certainty of Closing', description: 'Prioritize offers most likely to close' },
  { key: 'contingencies', label: 'Minimize Contingencies', description: 'Prefer cleaner, less conditional offers' },
  { key: 'speed', label: 'Fastest Close', description: 'Prioritize shortest closing timeline' },
  { key: 'leaseback', label: 'Leaseback Flexibility', description: 'Value leaseback terms from buyer' },
  { key: 'repair', label: 'Minimize Repair Risk', description: 'Reduce likelihood of repair negotiations' },
  { key: 'financial', label: 'Strongest Financials', description: 'Prioritize best-qualified buyers' },
];

export default function SellerPriorities() {
  const [weights, setWeights] = useState<Record<string, number>>({
    price: 80, certainty: 70, contingencies: 60, speed: 50, leaseback: 30, repair: 40, financial: 65,
  });

  const ranked = useMemo(() => {
    return [...sampleProperty.offers].map(o => {
      const score =
        (o.offerPrice / 10000000) * weights.price +
        (o.scores.closeProbability / 100) * weights.certainty +
        ((5 - o.contingencies.length) / 5) * weights.contingencies +
        ((60 - o.closeDays) / 60) * weights.speed +
        (o.leasebackRequest !== 'None' ? 1 : 0) * weights.leaseback +
        ((100 - o.scores.contingencyRisk) / 100) * weights.repair +
        (o.scores.financialConfidence / 100) * weights.financial;
      return { ...o, compositeScore: Math.round(score * 10) / 10 };
    }).sort((a, b) => b.compositeScore - a.compositeScore);
  }, [weights]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Priorities</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Seller Priorities</h1>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Sliders */}
          <div className="lg:col-span-2 card-elevated p-6 space-y-5">
            <h3 className="heading-display text-xl">What Matters Most?</h3>
            {priorities.map((p) => (
              <div key={p.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium font-body">{p.label}</label>
                  <span className="text-xs text-muted-foreground font-body">{weights[p.key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[p.key]}
                  onChange={(e) => setWeights(w => ({ ...w, [p.key]: Number(e.target.value) }))}
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-gold"
                />
                <p className="text-xs text-muted-foreground font-body mt-0.5">{p.description}</p>
              </div>
            ))}
          </div>

          {/* Rankings */}
          <div className="lg:col-span-3 space-y-3">
            <h3 className="heading-display text-xl">Live Ranking</h3>
            {ranked.map((o, i) => (
              <div key={o.id} className={`card-elevated p-5 flex items-center gap-4 transition-all duration-300 ${i === 0 ? 'border-accent/40' : ''}`}>
                <div className={`w-9 h-9 rounded-sm flex items-center justify-center font-medium text-sm font-body ${i === 0 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium font-body">{o.buyerName}</p>
                  <p className="text-[11px] text-muted-foreground font-body">{formatCurrency(o.offerPrice)} · {o.closeTimeline} · {o.financingType}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-light font-display">{o.compositeScore}</p>
                  <p className="text-[10px] text-muted-foreground font-body uppercase tracking-wide">score</p>
                </div>
                <div className="flex gap-1">
                  {o.labels.map(l => <span key={l} className="badge-gold text-xs">{l}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}