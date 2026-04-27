import AppLayout from '@/components/AppLayout';
import { useSearchParams } from 'react-router-dom';
import { resolveActiveAnalysisId, fetchAnalysisById } from '@/lib/activeAnalysis';
import { formatCurrency } from '@/data/sampleData';
import EmptyDealState from '@/components/EmptyDealState';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Crown, Shield, Scale, TrendingUp, Clock, AlertTriangle, CheckCircle, Sparkles, Zap, MessageSquare, ArrowRight, Loader2, Zap as ZapIcon, Gauge, FileWarning, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fetchOffersWithExtraction, triggerExtraction, saveRiskScore, touchDealAnalysis } from '@/lib/offerService';
import { adaptOffer } from '@/lib/offerAdapter';
import { computeScores } from '@/lib/scoringEngine';
import { Skeleton } from '@/components/ui/skeleton';

type SortKey =
  | 'price'
  | 'closeProb'
  | 'financial'
  | 'contingencyRisk'
  | 'timingRisk'
  | 'completeness';
import type { Offer as SampleOffer } from '@/data/sampleData';
type Offer = SampleOffer;
type OfferWithMeta = Offer & { missingItems?: string[]; notableRisks?: string[]; notableStrengths?: string[] };

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'price', label: 'Highest Price' },
  { key: 'closeProb', label: 'Close Probability' },
  { key: 'financial', label: 'Financial Confidence' },
  { key: 'contingencyRisk', label: 'Contingency Risk' },
  { key: 'timingRisk', label: 'Timing Risk' },
  { key: 'completeness', label: 'Completeness' },
];

/* ── Helpers (priceDelta is created inside the component scope so it can use real listing price) ── */

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
  const [offers, setOffers] = useState<OfferWithMeta[]>([]);
  const [property, setProperty] = useState({
    address: '',
    listingPrice: 0,
    sellerNotes: '',
    sellerGoals: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const activeId = await resolveActiveAnalysisId(user.id, searchParams);
        if (!activeId) { setLoading(false); return; }
        const analysis = await fetchAnalysisById(user.id, activeId);
        if (!analysis) { setLoading(false); return; }
        setAnalysisId(analysis.id);
        const rows = await fetchOffersWithExtraction(analysis.id);
        if (cancelled) return;
        const listingPrice = Number(analysis.properties?.listing_price ?? 0);
        if (rows.length === 0) { setLoading(false); return; }
        const adapted = rows.map(r => adaptOffer(r, listingPrice));
        setOffers(adapted);
        setProperty({
          address: analysis.properties?.address ?? 'Property',
          listingPrice,
          sellerNotes: analysis.properties?.seller_notes ?? '',
          sellerGoals: analysis.properties?.seller_goals ?? [],
        });
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? 'Failed to load offers');
          toast({ title: 'Could not load offers', description: e.message ?? 'Failed to load.', variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast, searchParams]);

  const priceDelta = (o: Offer) => o.offerPrice - property.listingPrice;
  const priceDeltaStr = (o: Offer) => {
    const d = priceDelta(o);
    return d >= 0 ? `+${formatCurrency(d)}` : formatCurrency(d);
  };

  const handleRerun = async () => {
    if (!analysisId) return;
    setRerunning(true);
    try {
      // Re-pull offers with documents
      const { data: dbOffers, error: oErr } = await supabase
        .from('offers')
        .select('id, buyer_name, documents(id, name, category)')
        .eq('deal_analysis_id', analysisId);
      if (oErr) throw oErr;

      let extracted = 0;
      for (const o of dbOffers ?? []) {
        const docs = (o as any).documents ?? [];
        if (docs.length === 0) continue;
        try {
          await triggerExtraction(
            o.id,
            (o as any).buyer_name ?? 'Offer',
            docs.map((d: any) => ({ id: d.id, name: d.name, category: d.category })),
          );
          extracted++;
        } catch (e) {
          console.error('Re-extract failed for', o.id, e);
        }
      }

      // Reload analysis + offers (listing price may have changed)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const analysis = await fetchAnalysisById(user.id, analysisId);
      const listingPrice = Number(analysis?.properties?.listing_price ?? 0);
      const rows = await fetchOffersWithExtraction(analysisId);
      const adapted = rows.map(r => adaptOffer(r, listingPrice));

      // Recompute + persist risk scores against fresh listing price
      let scored = 0;
      for (const offer of adapted) {
        const s = computeScores(offer, listingPrice);
        try {
          await saveRiskScore(offer.id, {
            offerStrength: s.offerStrength.score,
            closeProbability: s.closeProbability.score,
            financialConfidence: s.financialConfidence.score,
            contingencyRisk: s.contingencyRisk.score,
            timingRisk: s.timingRisk.score,
            packageCompleteness: s.packageCompleteness.score,
            factorDetails: {
              offer_strength: s.offerStrength.factors,
              close_probability: s.closeProbability.factors,
              financial_confidence: s.financialConfidence.factors,
              contingency_risk: s.contingencyRisk.factors,
              timing_risk: s.timingRisk.factors,
              package_completeness: s.packageCompleteness.factors,
            },
          });
          scored++;
        } catch (e) {
          console.error('Score save failed for', offer.id, e);
        }
      }

      await touchDealAnalysis(analysisId);

      setOffers(adapted);
      setProperty({
        address: analysis?.properties?.address ?? 'Property',
        listingPrice,
        sellerNotes: analysis?.properties?.seller_notes ?? '',
        sellerGoals: analysis?.properties?.seller_goals ?? [],
      });

      toast({
        title: 'Analysis refreshed',
        description: `Re-extracted ${extracted} offer${extracted === 1 ? '' : 's'} and re-scored ${scored}.`,
      });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Re-run failed', description: e?.message ?? 'Could not refresh analysis.', variant: 'destructive' });
    } finally {
      setRerunning(false);
    }
  };

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

  const hasOffers = offers.length > 0;

  /* Short-circuit before any reduce on empty arrays — covers loading + empty */
  if (!hasOffers) {
    if (loading) {
      return (
        <AppLayout>
          <div className="max-w-5xl mx-auto py-12 text-[12px] text-muted-foreground font-body">Loading offers…</div>
        </AppLayout>
      );
    }
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto py-12 animate-fade-in">
          <div className="mb-8">
            <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Comparison</p>
            <h1 className="heading-display text-3xl lg:text-4xl text-foreground">No offers to compare</h1>
          </div>
          <EmptyDealState
            title="No offers in your latest analysis"
            message="Comparison comes alive once you've uploaded offer packages. Start a new analysis or add offers to see a side-by-side breakdown across price, certainty, contingencies, timing, and completeness."
          />
        </div>
      </AppLayout>
    );
  }

  /* Compute bests for highlighting (safe — offers is non-empty here) */
  const maxPrice = hasOffers ? bestVal(offers, o => o.offerPrice, 'max') : 0;
  const minClose = hasOffers ? bestVal(offers, o => o.closeDays, 'min') : 0;
  const maxFinancial = hasOffers ? bestVal(offers, o => o.scores.financialConfidence, 'max') : 0;
  const minContingencies = hasOffers ? bestVal(offers, o => o.contingencies.length, 'min') : 0;
  const maxStrength = hasOffers ? bestVal(offers, o => o.scores.offerStrength, 'max') : 0;
  const maxCloseProb = hasOffers ? bestVal(offers, o => o.scores.closeProbability, 'max') : 0;

  /* Spotlight offers — Highest, Safest, Cleanest, Fastest, Best Balance */
  const highest = offers.reduce((a, b) => a.offerPrice > b.offerPrice ? a : b);
  const safest = offers.reduce((a, b) => a.scores.closeProbability > b.scores.closeProbability ? a : b);
  const cleanest = offers.reduce((a, b) => a.contingencies.length < b.contingencies.length ? a : b);
  const fastest = offers.reduce((a, b) => a.closeDays < b.closeDays ? a : b);
  const bestBalance = offers.reduce((a, b) => a.scores.offerStrength > b.scores.offerStrength ? a : b);

  // Per-offer dynamic badge map for inline pills
  const badgeMap: Record<string, string[]> = {};
  const pushBadge = (id: string, label: string) => { (badgeMap[id] ||= []).push(label); };
  pushBadge(highest.id, 'Highest');
  pushBadge(safest.id, 'Safest');
  pushBadge(cleanest.id, 'Cleanest');
  pushBadge(fastest.id, 'Fastest');
  pushBadge(bestBalance.id, 'Best Balance');

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
            <button
              onClick={handleRerun}
              disabled={rerunning || !analysisId}
              className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-medium font-body tracking-wide bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
              title="Re-extract offers and recompute risk scores against the current listing price and counter details"
            >
              {rerunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {rerunning ? 'Re-running…' : 'Re-run Analysis'}
            </button>
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

          {/* Negotiation history row — only shows when at least one offer has counters */}
          {sorted.some(o => (o.counters?.length ?? 0) > 1) && (
            <div className="card-elevated overflow-x-auto mb-px">
              <div className="flex">
                <div className="w-36 flex-shrink-0 p-4 flex items-start">
                  <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">Negotiation</span>
                </div>
                {sorted.map((o) => {
                  const chain = o.counters ?? [];
                  if (chain.length <= 1) {
                    return (
                      <div key={o.id} className="flex-1 min-w-[160px] p-4 border-l border-border/40">
                        <p className="text-[11px] text-muted-foreground font-body">No counters</p>
                      </div>
                    );
                  }
                  const statusLabel =
                    o.counterStatus === 'seller_countered' ? 'Awaiting buyer response' :
                    o.counterStatus === 'buyer_countered' ? 'Awaiting your response' :
                    o.counterStatus === 'accepted' ? 'Accepted' : 'Active negotiation';
                  return (
                    <div key={o.id} className="flex-1 min-w-[160px] p-4 border-l border-border/40 space-y-2">
                      {chain.map((c, i) => (
                        <div key={i} className="text-[11px] font-body">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-muted-foreground capitalize">
                              {c.label || (c.party === 'seller' ? `Seller counter #${i}` : i === 0 ? 'Buyer offer' : `Buyer counter #${i}`)}
                            </span>
                            {typeof c.price === 'number' && (
                              <span className="text-foreground font-medium">{formatCurrency(c.price)}</span>
                            )}
                          </div>
                          {c.key_changes?.length > 0 && (
                            <ul className="mt-0.5 ml-2 list-disc list-inside text-muted-foreground/80">
                              {c.key_changes.slice(0, 3).map((k, j) => <li key={j}>{k}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                      <p className="text-[10px] uppercase tracking-wider text-accent font-body font-medium pt-1 border-t border-border/40">
                        {statusLabel}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
          <p className="text-[13px] text-muted-foreground font-body mb-4 leading-relaxed">{property.sellerNotes}</p>
          <div className="flex flex-wrap gap-2">
            {(property.sellerGoals ?? []).map(g => (
              <span key={g} className="badge-gold">{g}</span>
            ))}
          </div>
        </div>

        {/* ── Missing Items & Weak Points ── */}
        <div>
          <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-4">Missing Items & Weak Points</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map(o => {
              const missing = o.missingItems ?? [];
              const risks = o.notableRisks ?? [];
              const strengths = o.notableStrengths ?? [];
              const isClean = missing.length === 0 && risks.length === 0;
              return (
                <div key={o.id} className="card-elevated p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium font-body text-foreground">{o.buyerName}</p>
                    <span className={`text-[10px] font-body px-2 py-0.5 rounded ${o.scores.packageCompleteness >= 90 ? 'bg-success/10 text-success' : o.scores.packageCompleteness >= 70 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                      {o.scores.packageCompleteness}% complete
                    </span>
                  </div>
                  {missing.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <FileWarning className="w-3.5 h-3.5 text-destructive" strokeWidth={1.5} />
                        <span className="text-[10px] tracking-wider uppercase text-destructive font-body font-medium">Missing</span>
                      </div>
                      <ul className="space-y-0.5">
                        {missing.map(m => <li key={m} className="text-[12px] text-muted-foreground font-body">· {m}</li>)}
                      </ul>
                    </div>
                  )}
                  {risks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-warning" strokeWidth={1.5} />
                        <span className="text-[10px] tracking-wider uppercase text-warning font-body font-medium">Weak points</span>
                      </div>
                      <ul className="space-y-0.5">
                        {risks.map(r => <li key={r} className="text-[12px] text-muted-foreground font-body">· {r}</li>)}
                      </ul>
                    </div>
                  )}
                  {strengths.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <CheckCircle className="w-3.5 h-3.5 text-success" strokeWidth={1.5} />
                        <span className="text-[10px] tracking-wider uppercase text-success font-body font-medium">Strengths</span>
                      </div>
                      <ul className="space-y-0.5">
                        {strengths.map(s => <li key={s} className="text-[12px] text-muted-foreground font-body">· {s}</li>)}
                      </ul>
                    </div>
                  )}
                  {isClean && strengths.length === 0 && (
                    <p className="text-[12px] text-muted-foreground font-body italic">No flagged items.</p>
                  )}
                </div>
              );
            })}
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

function AIStrategistPanel({
  highest,
  safest,
  cleanest,
  bestBalance,
  offers,
  property,
}: {
  highest: Offer;
  safest: Offer;
  cleanest: Offer;
  bestBalance: Offer;
  offers: Offer[];
  property: { address: string; listingPrice: number };
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<StrategistAnalysis | null>(null);
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
        counters: o.counters ?? [],
        counter_status: o.counterStatus ?? 'none',
      }));

      const response = await fetch(`${SUPABASE_URL}/functions/v1/compare-offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(SUPABASE_KEY ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
        },
        body: JSON.stringify({
          offers: offersPayload,
          property: { address: property.address, listingPrice: property.listingPrice },
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

  // Auto-run on mount / whenever the offer set changes, so the panel
  // never shows analysis from a different deal.
  const offerSig = offers.map(o => `${o.id}:${o.offerPrice}`).join('|');
  useEffect(() => {
    if (offers.length > 0) runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerSig]);

  const categoryCards = analysis ? [
    { label: 'Highest Price', icon: Crown, buyer: analysis.highest_offer.buyer, detail: formatCurrency(analysis.highest_offer.price), note: analysis.highest_offer.note, accent: 'border-accent/40' },
    { label: 'Safest Close', icon: Shield, buyer: analysis.safest_offer.buyer, detail: `${analysis.safest_offer.close_probability}% close prob.`, note: analysis.safest_offer.note, accent: 'border-success/40' },
    { label: 'Cleanest Structure', icon: CheckCircle, buyer: analysis.cleanest_offer.buyer, detail: `${analysis.cleanest_offer.contingency_count} contingency`, note: analysis.cleanest_offer.note, accent: 'border-info/40' },
    { label: 'Best Balance', icon: Scale, buyer: analysis.best_balance_offer.buyer, detail: 'Recommended', note: analysis.best_balance_offer.note, accent: 'border-accent/60 bg-accent/[0.03]' },
  ] : [];

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

      {isOpen && (
        <div className="border-t border-border">
          {!analysis && isLoading && (
            <div className="p-8 text-center text-[13px] text-muted-foreground font-body">
              Analyzing your {offers.length === 1 ? 'offer' : `${offers.length} offers`} for {property.address}…
            </div>
          )}
          {!analysis && !isLoading && (
            <div className="p-8 text-center text-[13px] text-muted-foreground font-body">
              Click <span className="text-foreground font-medium">Re-analyze</span> to generate a strategist read of these offers.
            </div>
          )}
          {analysis && (
          <>
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
          </>
          )}
        </div>
      )}
    </div>
  );
}