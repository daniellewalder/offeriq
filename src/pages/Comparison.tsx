import AppLayout from '@/components/AppLayout';
import { sampleProperty, formatCurrency } from '@/data/sampleData';
import { useMemo, useState } from 'react';
import { ArrowUpDown, Crown, Shield, Scale, TrendingUp, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

type SortKey = 'price' | 'risk' | 'close' | 'financial' | 'contingencies';
type Offer = (typeof sampleProperty.offers)[0];

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'price', label: 'Highest Price' },
  { key: 'risk', label: 'Lowest Risk' },
  { key: 'close', label: 'Shortest Close' },
  { key: 'financial', label: 'Strongest Financial' },
  { key: 'contingencies', label: 'Fewest Contingencies' },
];

/* ── Helpers ── */
const priceDelta = (o: Offer) => o.offerPrice - sampleProperty.listingPrice;
const priceDeltaStr = (o: Offer) => {
  const d = priceDelta(o);
  return d >= 0 ? `+${formatCurrency(d)}` : formatCurrency(d);
};

function bestVal<T>(offers: Offer[], fn: (o: Offer) => T, compare: 'max' | 'min'): T {
  const vals = offers.map(fn);
  return compare === 'max' ? (vals.reduce((a, b) => (a > b ? a : b)) as T) : (vals.reduce((a, b) => (a < b ? a : b)) as T);
}

const Bar = ({ pct, color }: { pct: number; color: string }) => (
  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1.5">
    <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.max(pct, 4)}%` }} />
  </div>
);

export default function Comparison() {
  const [sortBy, setSortBy] = useState<SortKey>('price');
  const offers = sampleProperty.offers;

  const sorted = useMemo(() => [...offers].sort((a, b) => {
    switch (sortBy) {
      case 'price': return b.offerPrice - a.offerPrice;
      case 'risk': return a.scores.contingencyRisk - b.scores.contingencyRisk;
      case 'close': return a.closeDays - b.closeDays;
      case 'financial': return b.scores.financialConfidence - a.scores.financialConfidence;
      case 'contingencies': return a.contingencies.length - b.contingencies.length;
    }
  }), [sortBy, offers]);

  /* Compute bests for highlighting */
  const maxPrice = bestVal(offers, o => o.offerPrice, 'max');
  const minClose = bestVal(offers, o => o.closeDays, 'min');
  const maxFinancial = bestVal(offers, o => o.scores.financialConfidence, 'max');
  const minContingencies = bestVal(offers, o => o.contingencies.length, 'min');
  const maxStrength = bestVal(offers, o => o.scores.offerStrength, 'max');
  const maxCloseProb = bestVal(offers, o => o.scores.closeProbability, 'max');

  /* Spotlight offers */
  const highest = offers.reduce((a, b) => a.offerPrice > b.offerPrice ? a : b);
  const safest = offers.reduce((a, b) => a.scores.closeProbability > b.scores.closeProbability ? a : b);
  const bestBalance = offers.reduce((a, b) => a.scores.offerStrength > b.scores.offerStrength ? a : b);

  const spotlights = [
    { label: 'Highest Price', icon: Crown, offer: highest, value: formatCurrency(highest.offerPrice), sub: priceDeltaStr(highest) + ' vs. list', accent: 'border-accent/50 bg-accent/[0.03]' },
    { label: 'Safest Close', icon: Shield, offer: safest, value: `${safest.scores.closeProbability}%`, sub: 'close probability', accent: 'border-success/30 bg-success/[0.03]' },
    { label: 'Best Balance', icon: Scale, offer: bestBalance, value: `${bestBalance.scores.offerStrength}/100`, sub: 'overall strength', accent: 'border-info/30 bg-info/[0.03]' },
  ];

  const isBest = (o: Offer, val: number | string, best: number | string) => val === best;

  return (
    <AppLayout>
      <div className="max-w-full mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Comparison</p>
            <h1 className="heading-display text-3xl lg:text-4xl text-foreground">{sampleProperty.address}</h1>
            <p className="text-[13px] text-muted-foreground font-body mt-2">
              {offers.length} offers · Listed at {formatCurrency(sampleProperty.listingPrice)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="flex gap-1.5 flex-wrap">
              {sortOptions.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={`px-3 py-1.5 rounded-sm text-[11px] font-medium font-body transition-colors tracking-wide ${
                    sortBy === s.key ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Spotlight Cards ── */}
        <div className="grid sm:grid-cols-3 gap-4">
          {spotlights.map((sp) => (
            <div key={sp.label} className={`rounded-md border p-5 ${sp.accent}`}>
              <div className="flex items-center gap-2 mb-3">
                <sp.icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">{sp.label}</span>
              </div>
              <p className="heading-display text-2xl text-foreground">{sp.value}</p>
              <p className="text-[11px] text-muted-foreground font-body mt-0.5">{sp.sub}</p>
              <p className="text-[13px] font-medium font-body mt-2 text-foreground">{sp.offer.buyerName}</p>
            </div>
          ))}
        </div>

        {/* ── Key Terms Comparison ── */}
        <div>
          <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-4">Key Terms</p>

          {/* Price Row — Hero */}
          <div className="card-elevated overflow-x-auto mb-px">
            <div className="flex">
              <div className="w-36 flex-shrink-0 p-4 flex items-center">
                <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">Offer Price</span>
              </div>
              {sorted.map((o) => {
                const best = o.offerPrice === maxPrice;
                const delta = priceDelta(o);
                const pct = ((o.offerPrice - 8500000) / (9300000 - 8500000)) * 100;
                return (
                  <div key={o.id} className={`flex-1 min-w-[160px] p-4 border-l border-border/40 ${best ? 'bg-accent/[0.04]' : ''}`}>
                    <p className={`font-display text-xl ${best ? 'text-foreground font-medium' : 'text-foreground font-light'}`}>
                      {formatCurrency(o.offerPrice)}
                    </p>
                    <p className={`text-[11px] font-body mt-0.5 ${delta >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {delta >= 0 ? '+' : ''}{formatCurrency(delta)} vs. list
                    </p>
                    <Bar pct={pct} color={best ? 'bg-accent' : 'bg-muted-foreground/30'} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financing Row */}
          <div className="card-elevated overflow-x-auto mb-px">
            <div className="flex">
              <div className="w-36 flex-shrink-0 p-4 flex items-center">
                <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">Financial Strength</span>
              </div>
              {sorted.map((o) => {
                const best = o.scores.financialConfidence === maxFinancial;
                return (
                  <div key={o.id} className={`flex-1 min-w-[160px] p-4 border-l border-border/40 ${best ? 'bg-success/[0.03]' : ''}`}>
                    <div className="flex items-baseline gap-2">
                      <span className={`font-display text-lg ${best ? 'text-success' : 'text-foreground'}`}>{o.scores.financialConfidence}</span>
                      <span className="text-[10px] text-muted-foreground font-body">/100</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground font-body mt-0.5">{o.financingType}</p>
                    <p className="text-[11px] text-muted-foreground font-body">{o.downPaymentPercent}% down · {formatCurrency(o.earnestMoney)} EMD</p>
                    <Bar pct={o.scores.financialConfidence} color={best ? 'bg-success' : 'bg-muted-foreground/30'} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Close Timeline Row */}
          <div className="card-elevated overflow-x-auto mb-px">
            <div className="flex">
              <div className="w-36 flex-shrink-0 p-4 flex items-center">
                <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">Close Timeline</span>
              </div>
              {sorted.map((o) => {
                const best = o.closeDays === minClose;
                const pct = ((45 - o.closeDays) / (45 - 14)) * 100;
                return (
                  <div key={o.id} className={`flex-1 min-w-[160px] p-4 border-l border-border/40 ${best ? 'bg-info/[0.03]' : ''}`}>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <span className={`font-display text-lg ${best ? 'text-info' : 'text-foreground'}`}>{o.closeTimeline}</span>
                    </div>
                    <Bar pct={pct} color={best ? 'bg-info' : 'bg-muted-foreground/30'} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contingencies Row */}
          <div className="card-elevated overflow-x-auto mb-px">
            <div className="flex">
              <div className="w-36 flex-shrink-0 p-4 flex items-center">
                <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">Contingencies</span>
              </div>
              {sorted.map((o) => {
                const count = o.contingencies.length;
                const best = count === minContingencies;
                return (
                  <div key={o.id} className={`flex-1 min-w-[160px] p-4 border-l border-border/40 ${best ? 'bg-success/[0.03]' : count >= 3 ? 'bg-destructive/[0.02]' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {count === 0 ? (
                        <CheckCircle className="w-3.5 h-3.5 text-success" strokeWidth={1.5} />
                      ) : count >= 3 ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive" strokeWidth={1.5} />
                      ) : null}
                      <span className={`font-body text-[13px] font-medium ${best ? 'text-success' : count >= 3 ? 'text-destructive' : 'text-foreground'}`}>
                        {count === 0 ? 'None' : `${count} contingenc${count === 1 ? 'y' : 'ies'}`}
                      </span>
                    </div>
                    {count > 0 && (
                      <div className="space-y-0.5">
                        {o.contingencies.map(c => (
                          <p key={c} className="text-[11px] text-muted-foreground font-body">· {c}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leaseback Row */}
          <div className="card-elevated overflow-x-auto mb-px">
            <div className="flex">
              <div className="w-36 flex-shrink-0 p-4 flex items-center">
                <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">Leaseback</span>
              </div>
              {sorted.map((o) => (
                <div key={o.id} className="flex-1 min-w-[160px] p-4 border-l border-border/40">
                  <p className={`text-[13px] font-body ${o.leasebackRequest === 'None' ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                    {o.leasebackRequest}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Concessions Row */}
          <div className="card-elevated overflow-x-auto mb-px">
            <div className="flex">
              <div className="w-36 flex-shrink-0 p-4 flex items-center">
                <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">Concessions</span>
              </div>
              {sorted.map((o) => (
                <div key={o.id} className="flex-1 min-w-[160px] p-4 border-l border-border/40">
                  <p className={`text-[13px] font-body ${o.concessions === 'None' ? 'text-muted-foreground' : 'text-warning font-medium'}`}>
                    {o.concessions}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Appraisal Row */}
          <div className="card-elevated overflow-x-auto mb-px">
            <div className="flex">
              <div className="w-36 flex-shrink-0 p-4 flex items-center">
                <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">Appraisal</span>
              </div>
              {sorted.map((o) => (
                <div key={o.id} className="flex-1 min-w-[160px] p-4 border-l border-border/40">
                  <p className={`text-[13px] font-body ${o.appraisalTerms === 'Waived' ? 'text-success font-medium' : 'text-foreground'}`}>
                    {o.appraisalTerms}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Scores Comparison ── */}
        <div>
          <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-4">Offer Scores</p>

          <div className="card-elevated overflow-x-auto">
            {/* Header */}
            <div className="flex border-b border-border/60">
              <div className="w-36 flex-shrink-0 p-4" />
              {sorted.map((o) => (
                <div key={o.id} className="flex-1 min-w-[160px] p-4 border-l border-border/40">
                  <p className="text-[13px] font-medium font-body text-foreground">{o.buyerName}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {o.labels.map(l => <span key={l} className="badge-gold">{l}</span>)}
                  </div>
                </div>
              ))}
            </div>

            {/* Strength */}
            <div className="flex border-b border-border/30">
              <div className="w-36 flex-shrink-0 p-4 flex items-center">
                <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">Strength</span>
              </div>
              {sorted.map((o) => {
                const best = o.scores.offerStrength === maxStrength;
                return (
                  <div key={o.id} className={`flex-1 min-w-[160px] p-4 border-l border-border/40 ${best ? 'bg-accent/[0.04]' : ''}`}>
                    <span className={`font-display text-2xl ${best ? 'text-accent font-medium' : 'text-foreground font-light'}`}>{o.scores.offerStrength}</span>
                    <span className="text-[10px] text-muted-foreground font-body ml-0.5">/100</span>
                    <Bar pct={o.scores.offerStrength} color={best ? 'bg-accent' : 'bg-muted-foreground/25'} />
                  </div>
                );
              })}
            </div>

            {/* Close Probability */}
            <div className="flex border-b border-border/30">
              <div className="w-36 flex-shrink-0 p-4 flex items-center">
                <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">Close Prob.</span>
              </div>
              {sorted.map((o) => {
                const best = o.scores.closeProbability === maxCloseProb;
                return (
                  <div key={o.id} className={`flex-1 min-w-[160px] p-4 border-l border-border/40 ${best ? 'bg-success/[0.03]' : ''}`}>
                    <span className={`font-display text-2xl ${best ? 'text-success font-medium' : 'text-foreground font-light'}`}>{o.scores.closeProbability}</span>
                    <span className="text-[10px] text-muted-foreground font-body ml-0.5">%</span>
                    <Bar pct={o.scores.closeProbability} color={best ? 'bg-success' : 'bg-muted-foreground/25'} />
                  </div>
                );
              })}
            </div>

            {/* Contingency Risk */}
            <div className="flex border-b border-border/30">
              <div className="w-36 flex-shrink-0 p-4 flex items-center">
                <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">Risk Level</span>
              </div>
              {sorted.map((o) => {
                const risk = o.scores.contingencyRisk;
                const color = risk <= 20 ? 'text-success' : risk <= 35 ? 'text-warning' : 'text-destructive';
                const barColor = risk <= 20 ? 'bg-success' : risk <= 35 ? 'bg-warning' : 'bg-destructive';
                return (
                  <div key={o.id} className={`flex-1 min-w-[160px] p-4 border-l border-border/40 ${risk >= 45 ? 'bg-destructive/[0.02]' : ''}`}>
                    <span className={`font-display text-2xl font-light ${color}`}>{risk}</span>
                    <span className="text-[10px] text-muted-foreground font-body ml-0.5">%</span>
                    <Bar pct={risk} color={barColor} />
                  </div>
                );
              })}
            </div>

            {/* Docs */}
            <div className="flex">
              <div className="w-36 flex-shrink-0 p-4 flex items-center">
                <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">Docs</span>
              </div>
              {sorted.map((o) => (
                <div key={o.id} className="flex-1 min-w-[160px] p-4 border-l border-border/40">
                  <div className="flex items-center gap-2">
                    <span className={`text-[12px] font-body ${o.proofOfFunds ? 'text-success' : 'text-destructive'}`}>
                      {o.proofOfFunds ? '✓' : '✗'} Funds
                    </span>
                    <span className={`text-[12px] font-body ${o.preApproval ? 'text-success' : 'text-muted-foreground'}`}>
                      {o.preApproval ? '✓' : '—'} Pre-Appr.
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-body mt-0.5">{o.scores.packageCompleteness}% complete</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Seller Context ── */}
        <div className="card-elevated p-6">
          <h3 className="heading-display text-xl mb-4">Seller Context</h3>
          <p className="text-[13px] text-muted-foreground font-body mb-4 leading-relaxed">{sampleProperty.sellerNotes}</p>
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