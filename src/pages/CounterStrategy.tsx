import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { formatCurrency } from "@/data/sampleData";
import EmptyDealState from "@/components/EmptyDealState";
import {
  TrendingUp,
  Shield,
  Scale,
  RefreshCw,
  FileText,
  Check,
  AlertTriangle,
  Loader2,
  Save,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLatestAnalysisForUser,
  fetchOffersWithExtraction,
  fetchLatestRiskScores,
  fetchSellerPriorities,
  fetchLatestLeverageSuggestions,
  fetchLatestCounterStrategies,
  saveCounterStrategies,
  type SellerPriorityWeights,
} from "@/lib/offerService";
import { adaptOffer } from "@/lib/offerAdapter";
import { computeScores, type ScoredOffer } from "@/lib/scoringEngine";
import {
  generateCounterStrategies,
  type CounterStrategy,
  type StrategyType,
} from "@/lib/counterStrategyEngine";
import { generateLeverage, type LeverageSuggestion } from "@/lib/leverageEngine";

const strategyMeta: Record<
  StrategyType,
  { icon: typeof TrendingUp; accent: string; iconBg: string }
> = {
  maximize_price: {
    icon: TrendingUp,
    accent: "border-accent/50",
    iconBg: "bg-accent/10 text-accent",
  },
  maximize_certainty: {
    icon: Shield,
    accent: "border-success/40",
    iconBg: "bg-success/10 text-success",
  },
  best_balance: {
    icon: Scale,
    accent: "border-info/40",
    iconBg: "bg-info/10 text-info",
  },
};

const likelihoodColor = (v: number) =>
  v >= 85 ? "text-success" : v >= 70 ? "text-info" : "text-warning";
const likelihoodBar = (v: number) =>
  v >= 85 ? "bg-success" : v >= 70 ? "bg-info" : "bg-warning";

export default function CounterStrategyPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [dealAnalysisId, setDealAnalysisId] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<CounterStrategy[]>([]);
  const [selected, setSelected] = useState<StrategyType>("best_balance");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        let listingPrice = 0;
        let goals: string[] = [];
        let offers: any[] = [];
        let scoresMap: Record<string, ScoredOffer | undefined> = {};
        let leverage: LeverageSuggestion[] = [];
        let priorities: SellerPriorityWeights | null = null;
        let analysisId: string | null = null;

        if (user) {
          const analysis = await fetchLatestAnalysisForUser(user.id);
          if (analysis) {
            analysisId = analysis.id;
            const property = (analysis as any).properties;
            if (property) {
              listingPrice = Number(property.listing_price ?? listingPrice);
              goals = (property.seller_goals as string[]) ?? goals;
            }

            const rows = await fetchOffersWithExtraction(analysis.id);
            if (rows.length > 0) {
              offers = rows.map((r) => adaptOffer(r, listingPrice));

              // Pull persisted scores; fall back to fresh compute.
              const persistedScores = await fetchLatestRiskScores(
                offers.map((o) => o.id),
              );
              for (const o of offers) {
                const persisted = persistedScores[o.id];
                scoresMap[o.id] = persisted
                  ? hydrateScoredOffer(persisted)
                  : computeScores(o, listingPrice);
              }

              // Pull persisted leverage; fall back to fresh generation.
              const persistedLev = await fetchLatestLeverageSuggestions(analysis.id);
              if (persistedLev && Array.isArray((persistedLev as any).suggestions)) {
                leverage = (persistedLev as any).suggestions as LeverageSuggestion[];
              } else {
                leverage = generateLeverage(offers, { listingPrice, goals }).suggestions;
              }

              const persistedPriorities = await fetchSellerPriorities(user.id, analysis.id);
              if (persistedPriorities) {
                priorities = {
                  price_weight: persistedPriorities.price_weight ?? 80,
                  certainty_weight: persistedPriorities.certainty_weight ?? 70,
                  contingencies_weight: persistedPriorities.contingencies_weight ?? 60,
                  speed_weight: persistedPriorities.speed_weight ?? 50,
                  leaseback_weight: persistedPriorities.leaseback_weight ?? 30,
                  repair_weight: persistedPriorities.repair_weight ?? 40,
                  financial_weight: persistedPriorities.financial_weight ?? 65,
                };
              }

              // Hydrate previously saved counter strategies.
              const savedStrategies = await fetchLatestCounterStrategies(analysis.id);
              if (savedStrategies && savedStrategies.length > 0) {
                const hydrated = savedStrategies
                  .map((row: any) => row.terms as CounterStrategy)
                  .filter(Boolean);
                if (active && hydrated.length > 0) {
                  setStrategies(hydrated);
                  setSavedAt(new Date(savedStrategies[0].generated_at));
                  setDealAnalysisId(analysisId);
                  setLoading(false);
                  return;
                }
              }
            }
          }
        }

        if (offers.length === 0) {
          if (active) { setStrategies([]); setDealAnalysisId(analysisId); setLoading(false); }
          return;
        }

        const bundle = generateCounterStrategies({
          offers,
          scores: scoresMap,
          leverage,
          priorities,
          listingPrice,
          sellerGoals: goals,
        });

        if (!active) return;
        setStrategies(bundle.strategies);
        setDealAnalysisId(analysisId);
      } catch (err: any) {
        toast({
          title: "Could not load strategies",
          description: err.message ?? String(err),
          variant: "destructive",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  const active = useMemo(
    () =>
      strategies.find((s) => s.strategy_type === selected) ?? strategies[0] ?? null,
    [strategies, selected],
  );

  const handleSave = async () => {
    if (!dealAnalysisId) {
      toast({
        title: "Sign in to save",
        description: "Strategies persist once an analysis is active.",
      });
      return;
    }
    if (strategies.length === 0) return;
    setSaving(true);
    try {
      const v = await saveCounterStrategies(dealAnalysisId, strategies);
      setSavedAt(new Date());
      toast({ title: "Strategies saved", description: `Stored as version ${v}.` });
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">
              Strategy
            </p>
            <h1 className="heading-display text-3xl lg:text-4xl text-foreground">
              Counter Strategy Builder
            </h1>
            <p className="text-[13px] text-muted-foreground font-body mt-2 max-w-2xl">
              Three distinct paths — each targeting a different offer with a different
              thesis. Built from offer data, risk scores, seller priorities, and the
              leverage points already on the table.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {savedAt && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-body">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                Saved {savedAt.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || loading || strategies.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-[12px] font-body font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saving ? "Saving…" : "Save strategies"}
            </button>
          </div>
        </div>

        {usingDemo && !loading && (
          <div className="rounded-md border border-border/50 bg-muted/30 px-4 py-2.5 text-[12px] text-muted-foreground font-body">
            Showing demo strategies. Run an analysis with real offers to generate from
            your own data.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-[13px] font-body">Building counter strategies…</span>
          </div>
        )}

        {!loading && strategies.length === 0 && (
          <div className="rounded-md border border-border/40 p-10 text-center text-[13px] text-muted-foreground font-body">
            No offers found yet. Add and extract offers to generate counter strategies.
          </div>
        )}

        {!loading && strategies.length > 0 && active && (
          <>
            {/* Strategy Selector */}
            <div className="grid sm:grid-cols-3 gap-3">
              {strategies.map((s) => {
                const meta = strategyMeta[s.strategy_type];
                const Icon = meta.icon;
                const isActive = (active.strategy_type === s.strategy_type);
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s.strategy_type)}
                    className={`text-left rounded-md border p-5 transition-all duration-300 ${
                      isActive
                        ? `${meta.accent} bg-card shadow-sm`
                        : "border-border/40 bg-card hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-8 h-8 rounded-sm flex items-center justify-center ${meta.iconBg}`}
                      >
                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[13px] font-medium font-body text-foreground">
                            {s.title}
                          </h3>
                          {s.recommended && (
                            <span className="badge-gold">Recommended</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-body leading-relaxed mb-3">
                      {s.subtitle}
                    </p>
                    <div className="flex items-baseline gap-3">
                      <span className="heading-display text-2xl text-foreground">
                        {formatCurrency(s.counter_price)}
                      </span>
                      <span
                        className={`text-[11px] font-body font-medium ${likelihoodColor(s.acceptance_likelihood)}`}
                      >
                        {s.acceptance_likelihood}% likely
                      </span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isActive
                            ? likelihoodBar(s.acceptance_likelihood)
                            : "bg-muted-foreground/20"
                        }`}
                        style={{ width: `${s.acceptance_likelihood}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail */}
            <StrategyDetail strategy={active} />
          </>
        )}
      </div>
    </AppLayout>
  );
}

function StrategyDetail({ strategy }: { strategy: CounterStrategy }) {
  const meta = strategyMeta[strategy.strategy_type];

  return (
    <div className={`rounded-md border ${meta.accent} bg-card`}>
      {/* Target offer context */}
      <div className="px-6 py-5 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-1">
            Countering
          </p>
          <p className="text-[15px] font-medium font-body text-foreground">
            {strategy.target_buyer}
          </p>
          <p className="text-[12px] text-muted-foreground font-body mt-0.5">
            {strategy.counter_price_delta} · target close {strategy.close_timeline}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body">
              Acceptance
            </p>
            <p
              className={`text-xl font-display ${likelihoodColor(strategy.acceptance_likelihood)}`}
            >
              {strategy.acceptance_likelihood}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body">
              Counter Price
            </p>
            <p className="text-xl font-display text-foreground">
              {formatCurrency(strategy.counter_price)}
            </p>
          </div>
        </div>
      </div>

      {/* Key terms */}
      <div className="px-6 py-5 border-b border-border/40">
        <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-4">
          Counter Terms
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Counter Price" value={formatCurrency(strategy.counter_price)} sub={strategy.counter_price_delta} />
          <Field label="Close Timeline" value={strategy.close_timeline} />
          <Field label="Earnest Money" value={strategy.deposit_recommendation} />
          <Field label="Leaseback" value={strategy.leaseback_terms} />
        </div>
      </div>

      {/* Contingency adjustments */}
      <div className="px-6 py-5 border-b border-border/40">
        <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-3">
          Contingency Adjustments
        </p>
        <div className="space-y-2.5">
          {strategy.contingency_changes.map((c, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <Check
                className="w-3.5 h-3.5 text-success flex-shrink-0 mt-1"
                strokeWidth={2}
              />
              <div>
                <p className="text-[13px] font-body font-medium text-foreground">
                  {c.term}: <span className="text-muted-foreground font-normal">{c.change}</span>
                </p>
                <p className="text-[11px] text-muted-foreground font-body mt-0.5 leading-relaxed">
                  {c.rationale}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Document requests */}
      {strategy.supporting_document_requests.length > 0 && (
        <div className="px-6 py-5 border-b border-border/40">
          <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-3">
            Supporting Document Requests
          </p>
          <div className="flex flex-wrap gap-1.5">
            {strategy.supporting_document_requests.map((d, i) => (
              <span key={i} className="badge-info">
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rationale */}
      <div className="px-6 py-5 border-b border-border/40">
        <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-2">
          Why This Works
        </p>
        <p className="text-[13px] text-muted-foreground font-body leading-[1.7]">
          {strategy.rationale}
        </p>
      </div>

      {/* Acceptance + Risk */}
      <div className="px-6 py-5 grid sm:grid-cols-2 gap-6 border-b border-border/40">
        <div>
          <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-2">
            Acceptance Likelihood
          </p>
          <p className="text-[12px] text-muted-foreground font-body leading-relaxed">
            {strategy.acceptance_likelihood_description}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle
              className="w-3.5 h-3.5 text-warning"
              strokeWidth={1.5}
            />
            <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">
              What Could Go Wrong
            </p>
          </div>
          <p className="text-[12px] text-muted-foreground font-body leading-relaxed">
            {strategy.risk}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 flex items-center gap-3">
        <button className="flex items-center gap-1.5 px-5 py-2.5 bg-foreground text-background rounded-sm text-[12px] font-medium font-body hover:opacity-90 transition-opacity tracking-wide">
          <FileText className="w-3.5 h-3.5" /> Generate Counter Letter
        </button>
        <button className="flex items-center gap-1.5 px-5 py-2.5 border border-border rounded-sm text-[12px] font-medium font-body hover:bg-muted/50 transition-colors tracking-wide">
          <RefreshCw className="w-3.5 h-3.5" /> Revise Terms
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium mb-0.5">
        {label}
      </p>
      <p className="text-[14px] font-body text-foreground font-medium">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground font-body mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Helpers ── */

function hydrateScoredOffer(row: any): ScoredOffer {
  // Build a minimal ScoredOffer from a persisted row so the engine can use its scores.
  const f = row.factor_details ?? {};
  const wrap = (score: number, key: string) => ({
    score: Number(score ?? 50),
    factors: f?.[key]?.factors ?? [],
    summary: f?.[key]?.summary ?? "",
  });
  return {
    offerStrength: wrap(row.offer_strength, "offerStrength"),
    closeProbability: wrap(row.close_probability, "closeProbability"),
    financialConfidence: wrap(row.financial_confidence, "financialConfidence"),
    contingencyRisk: wrap(row.contingency_risk, "contingencyRisk"),
    timingRisk: wrap(row.timing_risk, "timingRisk"),
    packageCompleteness: wrap(row.package_completeness, "packageCompleteness"),
  };
}
