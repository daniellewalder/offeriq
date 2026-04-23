import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { sampleProperty, formatCurrency } from '@/data/sampleData';
import { Crown, DollarSign, ShieldCheck, FileX, Zap, Home, Wrench, TrendingUp, ArrowRight, Brain, AlertTriangle, Target, Loader2, RefreshCw, Save, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchLatestAnalysisForUser,
  fetchOffersWithExtraction,
  fetchSellerPriorities,
  upsertSellerPriorities,
} from '@/lib/offerService';
import { adaptOffer } from '@/lib/offerAdapter';
import type { Offer } from '@/data/sampleData';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
function computeScores(weights: Record<PriorityKey, number>, offers: Offer[]) {
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0) || 1;
  return [...offers].map(o => {
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
  const [offers, setOffers] = useState<Offer[]>(sampleProperty.offers);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const ranked = useMemo(() => computeScores(weights, offers), [weights, offers]);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { toast } = useToast();

  const topOffer = ranked[0];
  const topChanged = prevTopId !== null && prevTopId !== topOffer.id;

  useEffect(() => {
    setPrevTopId(topOffer.id);
  }, [topOffer.id]);

  // Load real offers + saved priorities on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        const analysis = await fetchLatestAnalysisForUser(user.id);
        if (!analysis) return;
        setAnalysisId(analysis.id);

        const [offerRows, savedPriorities] = await Promise.all([
          fetchOffersWithExtraction(analysis.id),
          fetchSellerPriorities(user.id, analysis.id),
        ]);
        if (cancelled) return;

        if (offerRows.length > 0) {
          const lp = Number(analysis.properties?.listing_price ?? sampleProperty.listingPrice);
          setOffers(offerRows.map(r => adaptOffer(r, lp)));
          setUsingDemo(false);
        }

        if (savedPriorities) {
          setWeights({
            price: savedPriorities.price_weight ?? 80,
            certainty: savedPriorities.certainty_weight ?? 70,
            contingencies: savedPriorities.contingencies_weight ?? 60,
            speed: savedPriorities.speed_weight ?? 50,
            leaseback: savedPriorities.leaseback_weight ?? 30,
            repair: savedPriorities.repair_weight ?? 40,
            financial: savedPriorities.financial_weight ?? 65,
          });
          setLastSavedAt(new Date(savedPriorities.updated_at).toLocaleTimeString());
        }
      } catch (e: any) {
        toast({ title: 'Could not load saved priorities', description: 'Showing defaults.', variant: 'destructive' });
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  // Debounced auto-save when weights change
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);
  useEffect(() => {
    if (!hasMounted || !userId || !analysisId) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      try {
        await upsertSellerPriorities(userId, analysisId, {
          price_weight: weights.price,
          certainty_weight: weights.certainty,
          contingencies_weight: weights.contingencies,
          speed_weight: weights.speed,
          leaseback_weight: weights.leaseback,
          repair_weight: weights.repair,
          financial_weight: weights.financial,
        });
        setSaveStatus('saved');
        setLastSavedAt(new Date().toLocaleTimeString());
      } catch (e: any) {
        setSaveStatus('error');
        toast({ title: 'Save failed', description: e.message ?? 'Could not save priorities', variant: 'destructive' });
      }
    }, 700);
    return () => clearTimeout(t);
  }, [weights, userId, analysisId, hasMounted, toast]);

  const maxScore = ranked[0]?.compositeScore ?? 1;
  const spreadRange = maxScore - (ranked[ranked.length - 1]?.compositeScore ?? 0);

  const runAiRanking = async () => {
    setAiLoading(true);
    try {
      const offersPayload = offers.map(o => ({
        buyer: o.buyerName,
        agent: o.agentName,
        price: o.offerPrice,
        financing: o.financingType,
        down_payment_pct: o.downPaymentPercent,
        earnest_money: o.earnestMoney,
        contingencies: o.contingencies,
        close_days: o.closeDays,
        leaseback: o.leasebackRequest,
        concessions: o.concessions,
        proof_of_funds: o.proofOfFunds,
        pre_approval: o.preApproval,
        close_probability: o.scores.closeProbability,
        financial_confidence: o.scores.financialConfidence,
        contingency_risk: o.scores.contingencyRisk,
      }));

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rank-offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(SUPABASE_KEY ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
        },
        body: JSON.stringify({
          offers: offersPayload,
          weights,
          property: { address: sampleProperty.address, listingPrice: sampleProperty.listingPrice },
        }),
      });

      const data = await response.json();
      if (!response.ok || data?.error) {
        toast({ title: 'AI Analysis Error', description: data?.error || 'Request failed', variant: 'destructive' });
      } else if (data?.analysis) {
        setAiAnalysis(data.analysis);
      }
    } catch (e: any) {
      toast({ title: 'AI Analysis Failed', description: e.message || 'Something went wrong', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

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

            {/* AI Strategist Section */}
            <div className="mt-6 rounded-md border border-border/60 bg-card">
              <div className="p-5 border-b border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-sm bg-accent/10 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-accent" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[13px] font-body font-medium text-foreground">AI Priority Strategist</p>
                    <p className="text-[11px] text-muted-foreground font-body">Re-ranks offers based on your seller's priorities</p>
                  </div>
                </div>
                <button
                  onClick={runAiRanking}
                  disabled={aiLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-[12px] font-body font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {aiLoading ? 'Analyzing…' : aiAnalysis ? 'Re-analyze' : 'Get AI Analysis'}
                </button>
              </div>

              {aiAnalysis && (
                <div className="p-5 space-y-5">
                  {/* Recommended Offer */}
                  {aiAnalysis.recommended_offer && (
                    <div className="rounded-md border border-accent/30 bg-accent/[0.04] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-accent" strokeWidth={1.5} />
                        <span className="text-[10px] tracking-[0.15em] uppercase text-accent font-body font-medium">AI Recommendation</span>
                      </div>
                      <p className="heading-display text-xl text-foreground">{aiAnalysis.recommended_offer.buyer}</p>
                      <p className="text-[13px] text-muted-foreground font-body mt-1 leading-relaxed">
                        {aiAnalysis.recommended_offer.why_this_offer_is_best_for_these_priorities}
                      </p>
                    </div>
                  )}

                  {/* AI Ranked Offers */}
                  {aiAnalysis.ranked_offers && (
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-3">AI-Ranked Order</p>
                      <div className="space-y-2">
                        {aiAnalysis.ranked_offers.map((ro: any, i: number) => (
                          <div key={i} className={`flex items-start gap-3 rounded-md border p-3 ${i === 0 ? 'border-accent/30 bg-accent/[0.02]' : 'border-border/40'}`}>
                            <div className={`w-6 h-6 rounded-sm flex items-center justify-center text-[11px] font-body font-medium flex-shrink-0 ${i === 0 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                              {ro.rank}
                            </div>
                            <div>
                              <p className="text-[13px] font-body font-medium text-foreground">{ro.buyer}</p>
                              <p className="text-[11px] text-muted-foreground font-body mt-0.5 leading-relaxed">{ro.score_rationale}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Priority Conflicts */}
                  {aiAnalysis.priority_conflicts?.length > 0 && (
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-3">Priority Conflicts</p>
                      <div className="space-y-2">
                        {aiAnalysis.priority_conflicts.map((conflict: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground font-body">
                            <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                            <span>{conflict}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Caution Flags */}
                  {aiAnalysis.caution_flags?.length > 0 && (
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-3">Caution Flags</p>
                      <div className="space-y-2">
                        {aiAnalysis.caution_flags.map((flag: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground font-body">
                            <ShieldCheck className="w-3.5 h-3.5 text-destructive/70 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                            <span>{flag}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Priority Shift Insight */}
                  {aiAnalysis.priority_shift_insight && (
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-[11px] text-muted-foreground font-body italic leading-relaxed">
                        💡 {aiAnalysis.priority_shift_insight}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}