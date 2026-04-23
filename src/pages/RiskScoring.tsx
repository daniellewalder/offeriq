import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { sampleProperty, formatCurrency } from '@/data/sampleData';
import { computeScores, type ScoreDetail } from '@/lib/scoringEngine';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Database, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchLatestAnalysisForUser, fetchOffersWithExtraction, saveRiskScore } from '@/lib/offerService';
import { adaptOffer } from '@/lib/offerAdapter';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Offer } from '@/data/sampleData';

const scoreLabels: { key: string; label: string; isRisk: boolean }[] = [
  { key: 'offerStrength', label: 'Offer Strength', isRisk: false },
  { key: 'closeProbability', label: 'Close Probability', isRisk: false },
  { key: 'financialConfidence', label: 'Financial Confidence', isRisk: false },
  { key: 'contingencyRisk', label: 'Contingency Risk', isRisk: true },
  { key: 'timingRisk', label: 'Timing Risk', isRisk: true },
  { key: 'packageCompleteness', label: 'Package Completeness', isRisk: false },
];

const scoreColor = (v: number, isRisk: boolean) => {
  if (isRisk) return v <= 20 ? 'text-success' : v <= 40 ? 'text-warning' : 'text-destructive';
  return v >= 85 ? 'text-success' : v >= 70 ? 'text-foreground' : 'text-warning';
};

const scoreAccent = (v: number, isRisk: boolean) => {
  if (isRisk) return v <= 20 ? 'bg-success' : v <= 40 ? 'bg-warning' : 'bg-destructive';
  return v >= 85 ? 'bg-success' : v >= 70 ? 'bg-accent' : 'bg-warning';
};

const scoreLabelText = (v: number, isRisk: boolean) => {
  if (isRisk) return v <= 20 ? 'Low' : v <= 40 ? 'Moderate' : 'Elevated';
  return v >= 85 ? 'Strong' : v >= 70 ? 'Solid' : 'Watch';
};

const factorBarColor = (impact: number, isRisk: boolean) => {
  if (isRisk) return impact > 0 ? 'bg-destructive/60' : 'bg-success/60';
  return impact > 0 ? 'bg-success/60' : 'bg-destructive/60';
};

export default function RiskScoring() {
  const [expandedCards, setExpandedCards] = useState<Record<string, string | null>>({});
  const [offers, setOffers] = useState<Offer[]>(sampleProperty.offers);
  const [listingPrice, setListingPrice] = useState(sampleProperty.listingPrice);
  const [usingDemo, setUsingDemo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const analysis = await fetchLatestAnalysisForUser(user.id);
        if (!analysis) return;
        const rows = await fetchOffersWithExtraction(analysis.id);
        if (cancelled || rows.length === 0) return;
        const lp = Number(analysis.properties?.listing_price ?? sampleProperty.listingPrice);
        setListingPrice(lp);
        setOffers(rows.map(r => adaptOffer(r, lp)));
        setUsingDemo(false);
      } catch (e: any) {
        toast({ title: 'Could not load live offers', description: 'Showing demo data instead.', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const scoredOffers = useMemo(() =>
    offers.map(offer => ({
      offer,
      scores: computeScores(offer, listingPrice),
    })),
    [offers, listingPrice]
  );

  const toggleCard = (offerId: string, scoreKey: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [offerId]: prev[offerId] === scoreKey ? null : scoreKey,
    }));
  };

  const handleSaveScores = async () => {
    if (usingDemo) {
      toast({ title: 'Sign in to save scores', description: 'Demo data cannot be persisted.' });
      return;
    }
    setSaving(true);
    try {
      let count = 0;
      for (const { offer, scores } of scoredOffers) {
        await saveRiskScore(offer.id, {
          offerStrength: scores.offerStrength.score,
          closeProbability: scores.closeProbability.score,
          financialConfidence: scores.financialConfidence.score,
          contingencyRisk: scores.contingencyRisk.score,
          timingRisk: scores.timingRisk.score,
          packageCompleteness: scores.packageCompleteness.score,
          factorDetails: {
            offer_strength: scores.offerStrength.factors,
            close_probability: scores.closeProbability.factors,
            financial_confidence: scores.financialConfidence.factors,
            contingency_risk: scores.contingencyRisk.factors,
            timing_risk: scores.timingRisk.factors,
            package_completeness: scores.packageCompleteness.factors,
          },
        });
        count++;
      }
      const ts = new Date().toLocaleTimeString();
      setSavedAt(ts);
      toast({ title: 'Scores saved', description: `Persisted scores for ${count} offer${count === 1 ? '' : 's'} at ${ts}.` });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message ?? 'Could not save scores', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div className="mb-2 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Risk Analysis</p>
            <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Quality & Risk Scoring</h1>
            <p className="text-[13px] text-muted-foreground font-body mt-2 max-w-2xl">
              Rules-based scoring with transparent factor breakdowns. Click any score to see exactly what's driving it.
              {usingDemo && <span className="ml-2 text-accent">· Demo data</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {savedAt && !saving && (
              <span className="flex items-center gap-1.5 text-[11px] text-success font-body">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved {savedAt}
              </span>
            )}
            <button
              onClick={handleSaveScores}
              disabled={saving || loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-sm bg-foreground text-background text-[12px] font-body font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              ) : (
                <><Database className="w-3.5 h-3.5" /> Save scores to database</>
              )}
            </button>
          </div>
        </div>

        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-md" />)}
          </div>
        )}

        {scoredOffers.map(({ offer, scores }) => (
          <div key={offer.id} className="card-elevated p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="heading-display text-xl">{offer.buyerName}</h3>
                <p className="text-[11px] text-muted-foreground font-body mt-1 tracking-wide">
                  {offer.agentName} · {offer.agentBrokerage} · {formatCurrency(offer.offerPrice)} · {offer.financingType}
                </p>
              </div>
              <div className="flex gap-1.5">
                {offer.labels.map(l => <span key={l} className="badge-gold text-xs">{l}</span>)}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {scoreLabels.map((s) => {
                const detail: ScoreDetail = scores[s.key as keyof typeof scores];
                const isExpanded = expandedCards[offer.id] === s.key;

                return (
                  <div key={s.key} className={`rounded-md border transition-all duration-300 ${scoreBg(detail.score, s.isRisk)} ${isExpanded ? 'ring-1 ring-accent/20' : ''}`}>
                    {/* Score header — clickable */}
                    <button
                      onClick={() => toggleCard(offer.id, s.key)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-medium text-muted-foreground font-body tracking-[0.1em] uppercase">{s.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-light font-display ${scoreColor(detail.score, s.isRisk)}`}>
                            {s.isRisk ? `${detail.score}%` : `${detail.score}/100`}
                          </span>
                          {isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          }
                        </div>
                      </div>
                      {/* Score bar */}
                      <div className="h-1 bg-muted rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${s.isRisk
                            ? (detail.score <= 20 ? 'bg-success' : detail.score <= 40 ? 'bg-warning' : 'bg-destructive')
                            : (detail.score >= 85 ? 'bg-success' : detail.score >= 70 ? 'bg-warning' : 'bg-destructive')
                          }`}
                          style={{ width: `${s.isRisk ? detail.score : detail.score}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground font-body leading-relaxed">{detail.summary}</p>
                    </button>

                    {/* Expanded factor breakdown */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2 animate-fade-in border-t border-border/30 pt-3">
                        <p className="text-[9px] tracking-[0.12em] uppercase text-muted-foreground font-body font-medium mb-2">Scoring Factors</p>
                        {detail.factors.map((f, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {f.impact > 0
                                  ? <TrendingUp className={`w-3 h-3 ${s.isRisk ? 'text-destructive/70' : 'text-success/70'}`} strokeWidth={1.5} />
                                  : f.impact < 0
                                  ? <TrendingDown className={`w-3 h-3 ${s.isRisk ? 'text-success/70' : 'text-destructive/70'}`} strokeWidth={1.5} />
                                  : <div className="w-3 h-3" />
                                }
                                <span className="text-[11px] font-body font-medium text-foreground">{f.label}</span>
                              </div>
                              <span className={`text-[11px] font-body font-medium tabular-nums ${f.impact > 0 ? (s.isRisk ? 'text-destructive' : 'text-success') : f.impact < 0 ? (s.isRisk ? 'text-success' : 'text-destructive') : 'text-muted-foreground'}`}>
                                {f.impact > 0 ? `+${f.impact}` : f.impact === 0 ? '—' : `${f.impact}`}
                              </span>
                            </div>
                            {/* Impact bar */}
                            {f.impact !== 0 && (
                              <div className="h-0.5 bg-muted rounded-full overflow-hidden ml-[18px]">
                                <div
                                  className={`h-full rounded-full ${factorBarColor(f.impact, s.isRisk)}`}
                                  style={{ width: `${Math.min(Math.abs(f.impact) * 4, 100)}%` }}
                                />
                              </div>
                            )}
                            <p className="text-[10px] text-muted-foreground font-body leading-relaxed ml-[18px]">{f.explanation}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}