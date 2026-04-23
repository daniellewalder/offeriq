import AppLayout from '@/components/AppLayout';
import { sampleProperty, formatCurrency } from '@/data/sampleData';
import { useState } from 'react';

const sellerDesired = {
  price: 9000000,
  closeDays: 30,
  contingencies: 0,
  concessions: 0,
  leaseback: 'Short rent-free leaseback',
  financingCertainty: 95,
};

const categories = ['Price', 'Timing', 'Contingencies', 'Concessions', 'Leaseback', 'Financing Certainty'] as const;

export default function DeltaView() {
  const [selectedOffer, setSelectedOffer] = useState(sampleProperty.offers[0].id);
  const offer = sampleProperty.offers.find(o => o.id === selectedOffer)!;

  const deltas = [
    { cat: 'Price', desired: formatCurrency(sellerDesired.price), actual: formatCurrency(offer.offerPrice), delta: offer.offerPrice - sellerDesired.price, pct: ((offer.offerPrice - sellerDesired.price) / sellerDesired.price * 100).toFixed(1) },
    { cat: 'Timing', desired: `${sellerDesired.closeDays} days`, actual: offer.closeTimeline, delta: sellerDesired.closeDays - offer.closeDays, pct: null },
    { cat: 'Contingencies', desired: 'None', actual: offer.contingencies.length === 0 ? 'None' : offer.contingencies.join(', '), delta: -offer.contingencies.length, pct: null },
    { cat: 'Concessions', desired: '$0', actual: offer.concessions, delta: offer.concessions === 'None' ? 0 : -1, pct: null },
    { cat: 'Leaseback', desired: sellerDesired.leaseback, actual: offer.leasebackRequest, delta: offer.leasebackRequest !== 'None' ? 1 : 0, pct: null },
    { cat: 'Financing Certainty', desired: `${sellerDesired.financingCertainty}%`, actual: `${offer.scores.financialConfidence}%`, delta: offer.scores.financialConfidence - sellerDesired.financingCertainty, pct: null },
  ];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="heading-display text-2xl lg:text-3xl font-semibold mb-1">Negotiation Delta View</h1>
          <p className="text-muted-foreground font-body text-sm">Visualize the gap between each offer and the seller's desired outcome.</p>
        </div>

        {/* Offer selector */}
        <div className="flex gap-2 flex-wrap">
          {sampleProperty.offers.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelectedOffer(o.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium font-body transition-colors ${
                selectedOffer === o.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {o.buyerName}
            </button>
          ))}
        </div>

        {/* Delta Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deltas.map((d) => {
            const isPositive = d.delta > 0;
            const isNeutral = d.delta === 0;
            return (
              <div key={d.cat} className={`card-elevated p-5 space-y-3 ${isPositive ? 'ring-1 ring-success/20' : isNeutral ? '' : 'ring-1 ring-warning/20'}`}>
                <h4 className="text-xs font-medium text-muted-foreground font-body uppercase tracking-wider">{d.cat}</h4>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-body">Seller Wants</p>
                    <p className="text-sm font-semibold font-body">{d.desired}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground font-body">Offer</p>
                    <p className="text-sm font-semibold font-body">{d.actual}</p>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-success' : isNeutral ? 'bg-muted-foreground/30' : 'bg-warning'}`}
                    style={{ width: `${Math.min(100, Math.abs(d.delta) <= 1 ? (isNeutral ? 50 : 30) : Math.min(100, 50 + d.delta / 100))}%` }}
                  />
                </div>
                {d.pct && (
                  <p className={`text-xs font-medium font-body ${isPositive ? 'text-success' : 'text-warning'}`}>
                    {isPositive ? '+' : ''}{d.pct}% from target
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Command center summary */}
        <div className="card-elevated p-6">
          <h3 className="heading-display text-lg font-semibold mb-3">Deal Intelligence Summary</h3>
          <p className="text-sm text-muted-foreground font-body leading-relaxed">
            <strong className="text-foreground">{offer.buyerName}</strong> — {offer.specialNotes}
            {' '}Key gaps: {deltas.filter(d => d.delta < 0).map(d => d.cat.toLowerCase()).join(', ') || 'none identified'}.
            {' '}Strengths: {deltas.filter(d => d.delta > 0).map(d => d.cat.toLowerCase()).join(', ') || 'none above target'}.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}