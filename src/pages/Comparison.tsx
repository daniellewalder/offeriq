import AppLayout from '@/components/AppLayout';
import { sampleProperty, formatCurrency, getScoreColor } from '@/data/sampleData';
import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';

type SortKey = 'price' | 'risk' | 'close' | 'financial' | 'contingencies';

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'price', label: 'Highest Price' },
  { key: 'risk', label: 'Lowest Risk' },
  { key: 'close', label: 'Shortest Close' },
  { key: 'financial', label: 'Strongest Financial' },
  { key: 'contingencies', label: 'Fewest Contingencies' },
];

export default function Comparison() {
  const [sortBy, setSortBy] = useState<SortKey>('price');

  const sorted = [...sampleProperty.offers].sort((a, b) => {
    switch (sortBy) {
      case 'price': return b.offerPrice - a.offerPrice;
      case 'risk': return a.scores.contingencyRisk - b.scores.contingencyRisk;
      case 'close': return a.closeDays - b.closeDays;
      case 'financial': return b.scores.financialConfidence - a.scores.financialConfidence;
      case 'contingencies': return a.contingencies.length - b.contingencies.length;
    }
  });

  const rows = [
    { label: 'Offer Price', get: (o: typeof sorted[0]) => formatCurrency(o.offerPrice) },
    { label: 'Financing', get: (o: typeof sorted[0]) => o.financingType },
    { label: 'Down Payment', get: (o: typeof sorted[0]) => `${o.downPaymentPercent}%` },
    { label: 'Earnest Money', get: (o: typeof sorted[0]) => formatCurrency(o.earnestMoney) },
    { label: 'Close Timeline', get: (o: typeof sorted[0]) => o.closeTimeline },
    { label: 'Contingencies', get: (o: typeof sorted[0]) => o.contingencies.length === 0 ? 'None' : o.contingencies.join(', ') },
    { label: 'Appraisal', get: (o: typeof sorted[0]) => o.appraisalTerms },
    { label: 'Leaseback', get: (o: typeof sorted[0]) => o.leasebackRequest },
    { label: 'Concessions', get: (o: typeof sorted[0]) => o.concessions },
    { label: 'Proof of Funds', get: (o: typeof sorted[0]) => o.proofOfFunds ? '✓' : '✗' },
    { label: 'Pre-Approval', get: (o: typeof sorted[0]) => o.preApproval ? '✓' : 'N/A' },
    { label: 'Strength Score', get: (o: typeof sorted[0]) => `${o.scores.offerStrength}/100` },
    { label: 'Close Probability', get: (o: typeof sorted[0]) => `${o.scores.closeProbability}%` },
  ];

  return (
    <AppLayout>
      <div className="max-w-full mx-auto space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="heading-display text-2xl lg:text-3xl font-semibold mb-1">Offer Comparison</h1>
            <p className="text-muted-foreground font-body text-sm">{sampleProperty.address}</p>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-1.5 flex-wrap">
              {sortOptions.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium font-body transition-colors ${
                    sortBy === s.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card-elevated overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground w-40">Term</th>
                {sorted.map((o) => (
                  <th key={o.id} className="text-left p-4 min-w-[180px]">
                    <p className="font-semibold text-foreground">{o.buyerName}</p>
                    <div className="flex gap-1 mt-1">
                      {o.labels.map(l => <span key={l} className="badge-gold text-xs">{l}</span>)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                  <td className="p-4 text-xs font-medium text-muted-foreground">{row.label}</td>
                  {sorted.map((o) => (
                    <td key={o.id} className="p-4 text-sm">{row.get(o)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Seller Summary */}
        <div className="card-elevated p-6">
          <h3 className="heading-display text-lg font-semibold mb-3">Seller Summary</h3>
          <p className="text-sm text-muted-foreground font-body mb-3">{sampleProperty.sellerNotes}</p>
          <div className="flex flex-wrap gap-2">
            {sampleProperty.sellerGoals.map(g => (
              <span key={g} className="badge-gold">{g}</span>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}