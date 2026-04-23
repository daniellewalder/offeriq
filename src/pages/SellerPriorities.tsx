import { useState, useMemo, useRef, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { sampleProperty, formatCurrency } from '@/data/sampleData';
import { Crown, DollarSign, ShieldCheck, FileX, Zap, Home, Wrench, TrendingUp, ArrowRight } from 'lucide-react';

type PriorityKey = 'price' | 'certainty' | 'contingencies' | 'speed' | 'leaseback' | 'repair' | 'financial';

const priorities: { key: PriorityKey; label: string; desc: string; icon: typeof DollarSign }[] = [
  { key: 'price', label: 'Price', desc: 'Highest net proceeds', icon: DollarSign },
  { key: 'certainty', label: 'Certainty', desc: 'Likelihood of closing', icon: ShieldCheck },
  { key: 'financial', label: 'Financials', desc: 'Buyer qualification strength', icon: TrendingUp },
  { key: 'contingencies', label: 'Clean Terms', desc: 'Fewer contingencies', icon: FileX },
  { key: 'speed', label: 'Speed', desc: 'Shortest closing timeline', icon: Zap },
  { key: 'leaseback', label: 'Leaseback', desc: 'Leaseback flexibility offered', icon: Home },
  { key: 'repair', label: 'Low Repair Risk', desc: 'Minimal repair negotiations', icon: Wrench },
];

const intensityLabel = (v: number) => {
  if (v <= 15) return 'Not important';
  if (v <= 40) return 'Nice to have';
  if (v <= 65) return 'Important';
  if (v <= 85) return 'Very important';
  return 'Critical';
};

const intensityColor = (v: number) => {
  if (v <= 15) return 'text-muted-foreground/50';
  if (v <= 40) return 'text-muted-foreground';
  if (v <= 65) return 'text-foreground';
  if (v <= 85) return 'text-accent';
  return 'text-accent';
};

/* Score breakdown per-dimension for each offer so we can show factor contributions */
function computeScores(weights: Record<PriorityKey, number>) {
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0) || 1;
  return [...sampleProperty.offers].map(o => {
    const factors: Record<PriorityKey, number> = {
      price: (o.offerPrice / 10000000),
      certainty: (o.scores.closeProbability / 100),
      contingencies: ((5 - o.contingencies.length) / 5),
      speed: ((60 - o.closeDays) / 60),
      leaseback: (o.leasebackRequest !== 'None' ? 1 : 0),
      repair: ((100 - o.scores.contingencyRisk) / 100),
      financial: (o.scores.financialConfidence / 100),
    };
    const rawScore = Object.entries(factors).reduce((s, [k, v]) => s + v * weights[k as PriorityKey], 0);
    const normalizedScore = Math.round((rawScore / totalWeight) * 100);
    return { ...o, compositeScore: normalizedScore, factors };
  }).sort((a, b) => b.compositeScore - a.compositeScore);
}

export default function SellerPriorities() {
  const [weights, setWeights] = useState<Record<PriorityKey, number>>({
    price: 80, certainty: 70, contingencies: 60, speed: 50, leaseback: 30, repair: 40, financial: 65,
  });
  const [prevTopId, setPrevTopId] = useState<string | null>(null);
  const ranked = useMemo(() => computeScores(weights), [weights]);

  const topOffer = ranked[0];
  const topChanged = prevTopId !== null && prevTopId !== topOffer.id;

  useEffect(() => {
    setPrevTopId(topOffer.id);
  }, [topOffer.id]);

  const maxScore = ranked[0]?.compositeScore ?? 1;
  const spreadRange = maxScore - (ranked[ranked.length - 1]?.compositeScore ?? 0);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Priorities</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Seller Priority Mapping</h1>
          <p className="text-[13px] text-muted-foreground font-body mt-2">
            Adjust what matters most — the ranking updates instantly.
          </p>
        </div>

        {/* ── Top Recommendation Banner ── */}
        <div className={`rounded-md border p-6 transition-all duration-500 ${topChanged ? 'border-accent bg-accent/[0.05]' : 'border-border/60 bg-card'}`}>
          <div className="flex items-center gap-3 mb-1">
            <Crown className={`w-5 h-5 transition-colors duration-300 ${topChanged ? 'text-accent' : 'text-muted-foreground'}`} strokeWidth={1.5} />
            <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">Top Recommendation</span>
          </div>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className={`heading-display text-3xl text-foreground transition-all duration-300`}>{topOffer.buyerName}</p>
              <p className="text-[13px] text-muted-foreground font-body mt-1">
                {formatCurrency(topOffer.offerPrice)} · {topOffer.closeTimeline} · {topOffer.financingType}
              </p>
            </div>
            <div className="text-right">
              <p className="heading-display text-5xl text-foreground">{topOffer.compositeScore}</p>
              <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body mt-0.5">weighted score</p>
            </div>
          </div>
          {/* Factor contribution mini-bar for top offer */}
          <div className="flex gap-1 mt-5 h-2 rounded-full overflow-hidden bg-muted">
            {priorities.filter(p => weights[p.key] > 0).map((p) => {
              const contribution = topOffer.factors[p.key] * weights[p.key];
              const totalRaw = priorities.reduce((s, pr) => s + topOffer.factors[pr.key] * weights[pr.key], 0) || 1;
              const pct = (contribution / totalRaw) * 100;
              const colors: Record<PriorityKey, string> = {
                price: 'bg-accent', certainty: 'bg-success', financial: 'bg-info',
                contingencies: 'bg-success/70', speed: 'bg-info/70', leaseback: 'bg-warning', repair: 'bg-muted-foreground/40',
              };
              return <div key={p.key} className={`h-full ${colors[p.key]} transition-all duration-500`} style={{ width: `${pct}%` }} title={`${p.label}: ${Math.round(pct)}%`} />;
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {priorities.filter(p => weights[p.key] > 0).map(p => {
              const contribution = topOffer.factors[p.key] * weights[p.key];
              const totalRaw = priorities.reduce((s, pr) => s + topOffer.factors[pr.key] * weights[pr.key], 0) || 1;
              const pct = Math.round((contribution / totalRaw) * 100);
              const colors: Record<PriorityKey, string> = {
                price: 'bg-accent', certainty: 'bg-success', financial: 'bg-info',
                contingencies: 'bg-success/70', speed: 'bg-info/70', leaseback: 'bg-warning', repair: 'bg-muted-foreground/40',
              };
              return (
                <div key={p.key} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-sm ${colors[p.key]}`} />
                  <span className="text-[10px] text-muted-foreground font-body">{p.label} {pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* ── Priority Sliders ── */}
          <div className="lg:col-span-2 space-y-1">
            <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-4">Adjust Weights</p>

            <div className="space-y-0">
              {priorities.map((p) => {
                const val = weights[p.key];
                return (
                  <div key={p.key} className="group py-4 border-b border-border/40 last:border-none">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-7 h-7 rounded-sm flex items-center justify-center transition-colors duration-200 ${val > 65 ? 'bg-accent/10' : 'bg-muted'}`}>
                        <p.icon className={`w-3.5 h-3.5 transition-colors duration-200 ${val > 65 ? 'text-accent' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <label className="text-[13px] font-medium font-body text-foreground">{p.label}</label>
                          <span className={`text-[11px] font-body font-medium tabular-nums transition-colors duration-200 ${intensityColor(val)}`}>
                            {intensityLabel(val)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-body">{p.desc}</p>
                      </div>
                    </div>

                    {/* Custom slider track */}
                    <div className="relative h-6 flex items-center">
                      <div className="absolute inset-x-0 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent/70 transition-all duration-200"
                          style={{ width: `${val}%` }}
                        />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={val}
                        onChange={(e) => setWeights(w => ({ ...w, [p.key]: Number(e.target.value) }))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                      />
                      {/* Thumb indicator */}
                      <div
                        className="absolute w-3.5 h-3.5 rounded-full bg-card border-2 border-accent shadow-sm pointer-events-none transition-all duration-200"
                        style={{ left: `calc(${val}% - 7px)` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Live Ranking ── */}
          <div className="lg:col-span-3">
            <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-4">Live Ranking</p>

            <div className="space-y-2">
              {ranked.map((o, i) => {
                const isTop = i === 0;
                const barPct = maxScore > 0 ? (o.compositeScore / maxScore) * 100 : 0;
                const gap = i > 0 ? ranked[0].compositeScore - o.compositeScore : 0;

                return (
                  <div
                    key={o.id}
                    className={`rounded-md border p-5 transition-all duration-500 ${
                      isTop ? 'border-accent/40 bg-accent/[0.03]' : 'border-border/40 bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank badge */}
                      <div className={`w-8 h-8 rounded-sm flex items-center justify-center text-[13px] font-body font-medium transition-all duration-300 ${
                        isTop ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-[14px] font-body transition-all duration-300 ${isTop ? 'font-medium text-foreground' : 'text-foreground'}`}>
                            {o.buyerName}
                          </p>
                          {isTop && <span className="badge-gold">Recommended</span>}
                          {o.labels.map(l => <span key={l} className="badge-gold">{l}</span>)}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                          {formatCurrency(o.offerPrice)} · {o.closeTimeline} · {o.financingType}
                        </p>
                      </div>

                      {/* Score */}
                      <div className="text-right flex-shrink-0 w-20">
                        <p className={`heading-display text-2xl transition-all duration-300 ${isTop ? 'text-accent' : 'text-foreground'}`}>
                          {o.compositeScore}
                        </p>
                        {gap > 0 && (
                          <p className="text-[10px] text-muted-foreground font-body">−{gap} from #1</p>
                        )}
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isTop ? 'bg-accent' : 'bg-muted-foreground/25'}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>

                    {/* Per-factor breakdown for top offer */}
                    {isTop && (
                      <div className="mt-3 grid grid-cols-4 lg:grid-cols-7 gap-2">
                        {priorities.map(p => {
                          const factorVal = Math.round(o.factors[p.key] * 100);
                          const weight = weights[p.key];
                          return (
                            <div key={p.key} className="text-center">
                              <p className={`text-[15px] font-display ${weight > 50 ? 'text-foreground' : 'text-muted-foreground'}`}>{factorVal}</p>
                              <p className="text-[9px] text-muted-foreground font-body tracking-wide uppercase mt-0.5">{p.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Spread indicator */}
            <div className="mt-4 rounded-md border border-border/40 bg-card px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[11px] text-muted-foreground font-body">Score spread across all offers</span>
              </div>
              <span className="text-[13px] font-body font-medium text-foreground tabular-nums">{spreadRange} pts</span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}