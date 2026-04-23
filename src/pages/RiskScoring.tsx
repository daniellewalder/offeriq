import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { formatCurrency } from '@/data/sampleData';
import EmptyDealState from '@/components/EmptyDealState';
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
  const [offers, setOffers] = useState<Offer[]>([]);
  const [listingPrice, setListingPrice] = useState(0);
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
        const lp = Number(analysis.properties?.listing_price ?? 0);
        setListingPrice(lp);
        setOffers(rows.map(r => adaptOffer(r, lp)));
      } catch (e: any) {
        toast({ title: 'Could not load offers', description: e.message ?? 'Failed to load.', variant: 'destructive' });
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
    if (offers.length === 0) {
      toast({ title: 'No offers to score', description: 'Upload offers to compute and save scores.' });
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
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-border/70">
          <div>
            <p className="eyebrow mb-4">Risk Analysis</p>
            <h1 className="text-display-lg text-foreground">Quality &amp; Risk Scoring</h1>
            <p className="text-[13px] text-muted-foreground font-body mt-3 max-w-2xl leading-[1.7]">
              Rules-based scoring with transparent factor breakdowns. Tap any score to see exactly what's driving it.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {savedAt && !saving && (
              <span className="flex items-center gap-1.5 text-[11px] text-success font-body tracking-wide">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved {savedAt}
              </span>
            )}
            <button
              onClick={handleSaveScores}
              disabled={saving || loading}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              ) : (
                <><Database className="w-3.5 h-3.5" /> Save to database</>
              )}
            </button>
          </div>
        </div>

        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-md" />)}
          </div>
        )}

        {!loading && scoredOffers.length === 0 && (
          <EmptyDealState
            title="No offers to score yet"
            message="Risk scoring runs on uploaded offer packages. Once you've added offers, you'll see transparent factor breakdowns for strength, close probability, financial confidence, contingency risk, timing risk, and completeness."
          />
        )}

        {scoredOffers.map(({ offer, scores }) => (
          <div key={offer.id} className="card-elevated p-7 lg:p-9 space-y-7">
            <div className="flex items-end justify-between gap-4 flex-wrap pb-5 border-b border-border/60">
              <div>
                <p className="eyebrow-plain mb-2">Buyer</p>
                <h3 className="text-display-sm">{offer.buyerName}</h3>
                <p className="text-[12px] text-muted-foreground font-body mt-2 tracking-wide tabular-nums">
                  {offer.agentName} · {offer.agentBrokerage} · <span className="text-foreground font-medium">{formatCurrency(offer.offerPrice)}</span> · {offer.financingType}
                </p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {offer.labels.map(l => <span key={l} className="badge-gold">{l}</span>)}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {scoreLabels.map((s) => {
                const detail: ScoreDetail = scores[s.key as keyof typeof scores];
                const isExpanded = expandedCards[offer.id] === s.key;

                return (
                  <div
                    key={s.key}
                    className={`rounded-lg border transition-all duration-300 bg-card ${
                      isExpanded ? 'border-border-strong shadow-sm' : 'border-border/70 hover:border-border-strong'
                    }`}
                  >
                    <button onClick={() => toggleCard(offer.id, s.key)} className="w-full text-left p-5">
                      <div className="flex items-start justify-between mb-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="label-key">{s.label}</p>
                          <p className={`text-[10px] mt-1 font-body font-medium tracking-[0.16em] uppercase ${scoreColor(detail.score, s.isRisk)}`}>
                            {scoreLabelText(detail.score, s.isRisk)}
                          </p>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="score-numeral text-foreground">{detail.score}</span>
                          <span className="text-[10px] text-muted-foreground font-body tabular-nums">/100</span>
                        </div>
                      </div>
                      <div className="score-bar mb-3">
                        <span
                          className={scoreAccent(detail.score, s.isRisk)}
                          style={{ width: `${detail.score}%` }}
                        />
                      </div>
                      <p className="text-[12px] text-muted-foreground font-body leading-[1.6]">{detail.summary}</p>
                      <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground/80 font-body tracking-[0.16em] uppercase">
                        <span>{detail.factors.length} factor{detail.factors.length === 1 ? '' : 's'}</span>
                        <span className="flex items-center gap-1">
                          {isExpanded ? 'Hide' : 'Reveal'}
                          {isExpanded
                            ? <ChevronUp className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />
                          }
                        </span>
                      </div>
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