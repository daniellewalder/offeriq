import AppLayout from '@/components/AppLayout';
import { sampleProperty, formatCurrency } from '@/data/sampleData';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Crown, Shield, Scale, TrendingUp, Clock, AlertTriangle, CheckCircle, Sparkles, Zap, MessageSquare, ArrowRight, Loader2, Zap as ZapIcon, Gauge, FileWarning } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fetchLatestAnalysisForUser, fetchOffersWithExtraction } from '@/lib/offerService';
import { adaptOffer } from '@/lib/offerAdapter';
import { Skeleton } from '@/components/ui/skeleton';

type SortKey =
  | 'price'
  | 'closeProb'
  | 'financial'
  | 'contingencyRisk'
  | 'timingRisk'
  | 'completeness';
type Offer = (typeof sampleProperty.offers)[0];
type OfferWithMeta = Offer & { missingItems?: string[]; notableRisks?: string[]; notableStrengths?: string[] };

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'price', label: 'Highest Price' },
  { key: 'closeProb', label: 'Close Probability' },
  { key: 'financial', label: 'Financial Confidence' },
  { key: 'contingencyRisk', label: 'Contingency Risk' },
  { key: 'timingRisk', label: 'Timing Risk' },
  { key: 'completeness', label: 'Completeness' },
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
  const [offers, setOffers] = useState<OfferWithMeta[]>(sampleProperty.offers as OfferWithMeta[]);
  const [property, setProperty] = useState({
    address: sampleProperty.address,
    listingPrice: sampleProperty.listingPrice,
    sellerNotes: sampleProperty.sellerNotes,
    sellerGoals: sampleProperty.sellerGoals,
  });
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const analysis = await fetchLatestAnalysisForUser(user.id);
        if (!analysis) { setLoading(false); return; }
        const rows = await fetchOffersWithExtraction(analysis.id);
        if (cancelled) return;
        const listingPrice = Number(analysis.properties?.listing_price ?? sampleProperty.listingPrice);
        if (rows.length === 0) { setLoading(false); return; }
        const adapted = rows.map(r => adaptOffer(r, listingPrice));
        setOffers(adapted);
        setProperty({
          address: analysis.properties?.address ?? sampleProperty.address,
          listingPrice,
          sellerNotes: analysis.properties?.seller_notes ?? sampleProperty.sellerNotes,
          sellerGoals: analysis.properties?.seller_goals ?? sampleProperty.sellerGoals,
        });
        setUsingDemo(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? 'Failed to load offers');
          toast({ title: 'Could not load live offers', description: 'Showing demo data instead.', variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const sorted = useMemo(() => [...offers].sort((a, b) => {
    switch (sortBy) {
      case 'price': return b.offerPrice - a.offerPrice;
      case 'closeProb': return b.scores.closeProbability - a.scores.closeProbability;
      case 'financial': return b.scores.financialConfidence - a.scores.financialConfidence;
      case 'contingencyRisk': return a.scores.contingencyRisk - b.scores.contingencyRisk;
      case 'timingRisk': return a.scores.timingRisk - b.scores.timingRisk;
      case 'completeness': return b.scores.packageCompleteness - a.scores.packageCompleteness;
    }
  }), [sortBy, offers]);

  /* Compute bests for highlighting */
  const maxPrice = bestVal(offers, o => o.offerPrice, 'max');
  const minClose = bestVal(offers, o => o.closeDays, 'min');
  const maxFinancial = bestVal(offers, o => o.scores.financialConfidence, 'max');
  const minContingencies = bestVal(offers, o => o.contingencies.length, 'min');
  const maxStrength = bestVal(offers, o => o.scores.offerStrength, 'max');
  const maxCloseProb = bestVal(offers, o => o.scores.closeProbability, 'max');

  /* Spotlight offers — Highest, Safest, Cleanest, Fastest, Best Balance */
  const highest = offers.reduce((a, b) => a.offerPrice > b.offerPrice ? a : b);
  const safest = offers.reduce((a, b) => a.scores.closeProbability > b.scores.closeProbability ? a : b);
  const cleanest = offers.reduce((a, b) => a.contingencies.length < b.contingencies.length ? a : b);
  const fastest = offers.reduce((a, b) => a.closeDays < b.closeDays ? a : b);
  const bestBalance = offers.reduce((a, b) => a.scores.offerStrength > b.scores.offerStrength ? a : b);

  // Per-offer dynamic badge map for inline pills
  const badgeMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    const push = (id: string, label: string) => { (m[id] ||= []).push(label); };
    push(highest.id, 'Highest');
    push(safest.id, 'Safest');
    push(cleanest.id, 'Cleanest');
    push(fastest.id, 'Fastest');
    push(bestBalance.id, 'Best Balance');
    return m;
  }, [highest, safest, cleanest, fastest, bestBalance]);

  const spotlights = [
    { label: 'Highest Price', icon: Crown, offer: highest, value: formatCurrency(highest.offerPrice), sub: priceDelta(highest) >= 0 ? `+${formatCurrency(priceDelta(highest))} vs. list` : `${formatCurrency(priceDelta(highest))} vs. list`, accent: 'border-accent/50 bg-accent/[0.03]' },
    { label: 'Safest Close', icon: Shield, offer: safest, value: `${safest.scores.closeProbability}%`, sub: 'close probability', accent: 'border-success/30 bg-success/[0.03]' },
    { label: 'Cleanest', icon: CheckCircle, offer: cleanest, value: `${cleanest.contingencies.length}`, sub: cleanest.contingencies.length === 1 ? 'contingency' : 'contingencies', accent: 'border-info/30 bg-info/[0.03]' },
    { label: 'Fastest', icon: ZapIcon, offer: fastest, value: `${fastest.closeDays}d`, sub: 'to close', accent: 'border-warning/30 bg-warning/[0.03]' },
    { label: 'Best Balance', icon: Scale, offer: bestBalance, value: `${bestBalance.scores.offerStrength}/100`, sub: 'overall strength', accent: 'border-accent/60 bg-accent/[0.04]' },
  ];

  const isBest = (o: Offer, val: number | string, best: number | string) => val === best;

  return (
    <AppLayout>
      <div className="max-w-full mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Comparison</p>
            <h1 className="heading-display text-3xl lg:text-4xl text-foreground">{property.address}</h1>
            <p className="text-[13px] text-muted-foreground font-body mt-2">
              {offers.length} offers · Listed at {formatCurrency(property.listingPrice)}
              {usingDemo && <span className="ml-2 text-accent">· Demo data</span>}
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

        {loading && (
          <div className="grid sm:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
          </div>
        )}

        {/* ── Spotlight Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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

        {/* ── AI Strategist Analysis ── */}
        <AIStrategistPanel
          highest={highest}
          safest={safest}
          cleanest={cleanest}
          bestBalance={bestBalance}
          offers={offers}
          property={property}
        />

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
                const delta = o.offerPrice - property.listingPrice;
                const minP = bestVal(offers, x => x.offerPrice, 'min');
                const range = Math.max(maxPrice - minP, 1);
                const pct = ((o.offerPrice - minP) / range) * 100;
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
                const maxC = bestVal(offers, x => x.closeDays, 'max');
                const range = Math.max(maxC - minClose, 1);
                const pct = ((maxC - o.closeDays) / range) * 100;
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
                    {(badgeMap[o.id] ?? []).map(l => <span key={l} className="badge-gold">{l}</span>)}
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

/* ─────────────────────────────────────────────
   AI Strategist Analysis Panel
   ───────────────────────────────────────────── */

interface StrategistAnalysis {
  highest_offer: { buyer: string; price: number; note: string };
  safest_offer: { buyer: string; close_probability: number; note: string };
  cleanest_offer: { buyer: string; contingency_count: number; note: string };
  best_balance_offer: { buyer: string; note: string };
  ranking_summary: string;
  offer_by_offer_notes: { buyer: string; headline: string; analysis: string }[];
  top_tradeoffs: { tradeoff: string; recommendation: string }[];
}

// Realistic mock analysis
const MOCK_ANALYSIS: StrategistAnalysis = {
  highest_offer: {
    buyer: 'Robert Ashford III',
    price: 9250000,
    note: "The biggest number on the board, but it comes with three contingencies and a 45-day timeline. In luxury real estate, a high price that doesn't close is just a number on paper.",
  },
  safest_offer: {
    buyer: 'The Nakamura Trust',
    close_probability: 94,
    note: 'All-cash, 21-day close, JPMorgan-verified funds, and one of the top luxury agents in LA running the deal. If certainty is the priority, this is the cleanest path to the closing table.',
  },
  cleanest_offer: {
    buyer: 'The Nakamura Trust',
    contingency_count: 1,
    note: "Only one contingency — a 7-day inspection — and it's waived on appraisal. The Nakamura Trust is asking for almost nothing structurally, which means fewer points where the deal can unravel.",
  },
  best_balance_offer: {
    buyer: 'David & Sarah Chen',
    note: "The Chens aren't the highest or the fastest, but they're the most likely to actually close without drama. 100% package completeness, First Republic pre-approval, and they've volunteered flexibility on leaseback. When you factor in execution risk, the Chens' $8.9M is worth more than Ashford's $9.25M.",
  },
  ranking_summary: "You're choosing between Nakamura's speed and certainty at $9.1M, the Chens' reliability at $8.9M, and Ashford's top-dollar price with significant execution risk. Westside is playing a concession game that undercuts their own speed advantage, and the Kapoors are a strong dark horse with appraisal gap coverage that most financed buyers won't offer at this price point.",
  offer_by_offer_notes: [
    {
      buyer: 'The Nakamura Trust',
      headline: 'Speed and certainty at a premium',
      analysis: "All-cash, 21-day close, minimal contingencies. The $9.1M price is $350K above list and the JPMorgan verification letter is as strong as proof-of-funds gets. The only question is whether you want to leave $150K on the table versus Ashford's higher but riskier number.",
    },
    {
      buyer: 'David & Sarah Chen',
      headline: 'The deal that actually closes',
      analysis: "The best-prepared package in the group — every document present, leaseback flexibility offered unprompted, and a First Republic pre-approval that carries weight. Two contingencies are standard for a financed offer at this price. If you counter to $8.95M with tightened timelines, this becomes the strongest overall position.",
    },
    {
      buyer: 'Westside Holdings LLC',
      headline: 'Fast but asking for too much',
      analysis: "A 14-day close sounds compelling until you factor in the $50K concession request on top of the lowest price. The LLC structure also means you need to verify who you're actually selling to. Goldman-backed funds are real, but the operating agreement is still pending review.",
    },
    {
      buyer: 'Robert Ashford III',
      headline: 'Biggest number, biggest risk',
      analysis: "At $9.25M, this is $500K above list — but three contingencies, a 45-day timeline, and a paid leaseback request create multiple exit points. The $150K earnest money deposit is also the lowest relative to offer price in the group, which tells you something about commitment level.",
    },
    {
      buyer: 'Priya & Arun Kapoor',
      headline: 'The smart underdog',
      analysis: "Don't overlook the Kapoors. They volunteered appraisal gap coverage up to $200K — a move that eliminates one of the most common deal-killers for financed offers in luxury markets. Chase Private Client backing, 28-day close, and a rent-free leaseback. If you counter at $8.95M, this could be your safest financed path.",
    },
  ],
  top_tradeoffs: [
    {
      tradeoff: 'Take Nakamura at $9.1M for certainty, or counter Ashford to push toward $9.2M+ with tighter terms?',
      recommendation: "Counter Nakamura to $9.15M with a 14-day close. They're relocating and motivated — they'll likely accept. Don't chase Ashford's number unless you're willing to wait 45 days and absorb the risk of three contingencies falling through.",
    },
    {
      tradeoff: "Is the Chens' reliability worth $200K less than the top offer?",
      recommendation: "Yes, if you value certainty. Counter the Chens to $8.95M with 7-day inspections and 21-day loan contingency. Their agent has already signaled flexibility. The net-to-seller difference after accounting for Ashford's concession requests and timeline risk is closer to $100K than $350K.",
    },
    {
      tradeoff: 'Should you engage Westside Holdings despite the low price?',
      recommendation: "Only as leverage. Let the other buyers know you have a cash offer with a 14-day close. Don't counter Westside directly — their $50K concession request and below-list pricing signal they're looking for a deal, not paying a premium.",
    },
  ],
};

function AIStrategistPanel({
  highest,
  safest,
  cleanest,
  bestBalance,
  offers,
}: {
  highest: Offer;
  safest: Offer;
  cleanest: Offer;
  bestBalance: Offer;
  offers: Offer[];
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<StrategistAnalysis>(MOCK_ANALYSIS);
  const [activeTab, setActiveTab] = useState<'summary' | 'offers' | 'tradeoffs'>('summary');
  const { toast } = useToast();

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const runAnalysis = async () => {
    setIsLoading(true);
    try {
      const offersPayload = offers.map(o => ({
        buyer: o.buyerName,
        agent: o.agentName,
        price: o.offerPrice,
        financing: o.financingType,
        down_payment_pct: o.downPaymentPercent,
        earnest_money: o.earnestMoney,
        contingencies: o.contingencies,
        inspection_period: o.inspectionPeriod,
        appraisal_terms: o.appraisalTerms,
        close_days: o.closeDays,
        leaseback: o.leasebackRequest,
        concessions: o.concessions,
        proof_of_funds: o.proofOfFunds,
        pre_approval: o.preApproval,
        completeness: o.completeness,
        close_probability: o.scores.closeProbability,
        financial_confidence: o.scores.financialConfidence,
        contingency_risk: o.scores.contingencyRisk,
      }));

      const response = await fetch(`${SUPABASE_URL}/functions/v1/compare-offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(SUPABASE_KEY ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
        },
        body: JSON.stringify({
          offers: offersPayload,
          property: { address: sampleProperty.address, listingPrice: sampleProperty.listingPrice },
        }),
      });

      const data = await response.json();
      if (!response.ok || data?.error) {
        toast({ title: 'AI Analysis Error', description: data?.error || 'Request failed', variant: 'destructive' });
      } else if (data?.analysis) {
        setAnalysis(data.analysis);
      }
    } catch (e: any) {
      toast({ title: 'AI Analysis Failed', description: e.message || 'Something went wrong', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const categoryCards = [
    { label: 'Highest Price', icon: Crown, buyer: analysis.highest_offer.buyer, detail: formatCurrency(analysis.highest_offer.price), note: analysis.highest_offer.note, accent: 'border-accent/40' },
    { label: 'Safest Close', icon: Shield, buyer: analysis.safest_offer.buyer, detail: `${analysis.safest_offer.close_probability}% close prob.`, note: analysis.safest_offer.note, accent: 'border-success/40' },
    { label: 'Cleanest Structure', icon: CheckCircle, buyer: analysis.cleanest_offer.buyer, detail: `${analysis.cleanest_offer.contingency_count} contingency`, note: analysis.cleanest_offer.note, accent: 'border-info/40' },
    { label: 'Best Balance', icon: Scale, buyer: analysis.best_balance_offer.buyer, detail: 'Recommended', note: analysis.best_balance_offer.note, accent: 'border-accent/60 bg-accent/[0.03]' },
  ];

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="text-base font-semibold font-body">AI Strategist Analysis</h3>
            <p className="text-xs text-muted-foreground font-body">How a top listing agent would read these offers</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-body font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…</>
            ) : (
              <><Zap className="w-3.5 h-3.5" /> Re-analyze</>
            )}
          </button>
          <ArrowUpDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && analysis && (
        <div className="border-t border-border">
          {/* Tabs */}
          <div className="flex border-b border-border/60 px-5">
            {([
              { key: 'summary' as const, label: 'Strategic Summary' },
              { key: 'offers' as const, label: 'Offer-by-Offer' },
              { key: 'tradeoffs' as const, label: 'Key Tradeoffs' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-xs font-body font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-accent text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-5">
            {/* ── Summary Tab ── */}
            {activeTab === 'summary' && (
              <>
                {/* Ranking summary */}
                <div className="p-4 bg-muted/30 rounded-lg border border-border/60">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <p className="text-[13px] font-body leading-relaxed text-foreground">{analysis.ranking_summary}</p>
                  </div>
                </div>

                {/* Category cards */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {categoryCards.map(card => {
                    const Icon = card.icon;
                    return (
                      <div key={card.label} className={`p-4 rounded-lg border ${card.accent}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                          <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">{card.label}</span>
                        </div>
                        <p className="text-sm font-semibold font-body text-foreground">{card.buyer}</p>
                        <p className="text-xs text-accent font-body font-medium mt-0.5">{card.detail}</p>
                        <p className="text-xs text-muted-foreground font-body mt-2 leading-relaxed">{card.note}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Offer-by-Offer Tab ── */}
            {activeTab === 'offers' && (
              <div className="space-y-3">
                {analysis.offer_by_offer_notes.map((note, i) => (
                  <div key={i} className="p-4 rounded-lg border border-border hover:border-accent/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold font-body text-foreground">{note.buyer}</h4>
                      <span className="text-[10px] tracking-wider uppercase font-body text-accent font-medium px-2 py-0.5 bg-accent/10 rounded">{note.headline}</span>
                    </div>
                    <p className="text-[13px] text-muted-foreground font-body leading-relaxed">{note.analysis}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Tradeoffs Tab ── */}
            {activeTab === 'tradeoffs' && (
              <div className="space-y-4">
                {analysis.top_tradeoffs.map((t, i) => (
                  <div key={i} className="p-4 rounded-lg border border-border">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-body font-semibold text-accent">{i + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium font-body text-foreground mb-2">{t.tradeoff}</p>
                        <div className="flex items-start gap-2 p-3 bg-success/5 border border-success/20 rounded-lg">
                          <ArrowRight className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0" />
                          <p className="text-xs font-body text-foreground leading-relaxed">{t.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}