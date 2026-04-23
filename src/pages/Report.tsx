import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { sampleProperty, formatCurrency } from "@/data/sampleData";
import {
  Award,
  Shield,
  TrendingUp,
  Target,
  AlertTriangle,
  ArrowRight,
  Download,
  Sparkles,
  Loader2,
  Quote,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLatestAnalysisForUser,
  fetchOffersWithExtraction,
  fetchLatestRiskScores,
  fetchSellerPriorities,
  fetchLatestLeverageSuggestions,
  fetchLatestCounterStrategies,
  type SellerPriorityWeights,
} from "@/lib/offerService";
import { adaptOffer } from "@/lib/offerAdapter";
import { computeScores, type ScoredOffer } from "@/lib/scoringEngine";
import {
  generateLeverage,
  type LeverageSuggestion,
} from "@/lib/leverageEngine";
import {
  generateCounterStrategies,
  type CounterStrategy,
} from "@/lib/counterStrategyEngine";
import {
  generateRecommendationReport,
  type RecommendationReport,
  type RiskCallout,
} from "@/lib/recommendationEngine";

function hydrateScoredOffer(row: any): ScoredOffer {
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

const severityChip: Record<RiskCallout["severity"], string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-muted text-muted-foreground border-border",
};

export default function Report() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [propertyAddress, setPropertyAddress] = useState(sampleProperty.address);
  const [offerCount, setOfferCount] = useState(sampleProperty.offers.length);
  const [report, setReport] = useState<RecommendationReport | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        let listingPrice = sampleProperty.listingPrice;
        let goals = sampleProperty.sellerGoals;
        let offers = sampleProperty.offers;
        let address = sampleProperty.address;
        let scoresMap: Record<string, ScoredOffer | undefined> = {};
        let leverage: LeverageSuggestion[] = [];
        let strategies: CounterStrategy[] = [];
        let priorities: SellerPriorityWeights | null = null;
        let demo = true;

        if (user) {
          const analysis = await fetchLatestAnalysisForUser(user.id);
          if (analysis) {
            const property = (analysis as any).properties;
            if (property) {
              listingPrice = Number(property.listing_price ?? listingPrice);
              goals = (property.seller_goals as string[]) ?? goals;
              address = property.address ?? address;
            }

            const rows = await fetchOffersWithExtraction(analysis.id);
            if (rows.length > 0) {
              offers = rows.map((r) => adaptOffer(r, listingPrice));
              demo = false;

              const persistedScores = await fetchLatestRiskScores(
                offers.map((o) => o.id),
              );
              for (const o of offers) {
                const persisted = persistedScores[o.id];
                scoresMap[o.id] = persisted
                  ? hydrateScoredOffer(persisted)
                  : computeScores(o, listingPrice);
              }

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

              const savedStrategies = await fetchLatestCounterStrategies(analysis.id);
              if (savedStrategies && savedStrategies.length > 0) {
                strategies = savedStrategies
                  .map((row: any) => row.terms as CounterStrategy)
                  .filter(Boolean);
              }
            }
          }
        }

        if (demo) {
          for (const o of offers) scoresMap[o.id] = computeScores(o, listingPrice);
          leverage = generateLeverage(offers, { listingPrice, goals }).suggestions;
        }

        if (strategies.length === 0) {
          strategies = generateCounterStrategies({
            offers,
            scores: scoresMap,
            leverage,
            priorities,
            listingPrice,
            sellerGoals: goals,
          }).strategies;
        }

        const r = generateRecommendationReport({
          offers,
          scores: scoresMap,
          leverage,
          strategies,
          priorities,
          listingPrice,
          sellerGoals: goals,
        });

        if (!active) return;
        setReport(r);
        setUsingDemo(demo);
        setPropertyAddress(address);
        setOfferCount(offers.length);
      } catch (err: any) {
        toast({
          title: "Could not build report",
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

  const sameTopPick = useMemo(
    () => report && report.best_overall.offer_id === report.safest.offer_id,
    [report],
  );

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">
              Report
            </p>
            <h1 className="heading-display text-3xl lg:text-4xl text-foreground">
              Recommendation Report
            </h1>
            <p className="text-[13px] text-muted-foreground font-body mt-2">
              {propertyAddress} · {offerCount} offer{offerCount === 1 ? "" : "s"} analyzed
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="hidden sm:flex items-center gap-2 px-4 py-2 border border-border rounded-sm text-[12px] font-medium font-body hover:bg-muted/50 transition-colors tracking-wide"
          >
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>

        {usingDemo && !loading && (
          <div className="rounded-md border border-border/50 bg-muted/30 px-4 py-2.5 text-[12px] text-muted-foreground font-body">
            Showing a demo report. Run an analysis with real offers to generate one from your own data.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-[13px] font-body">Composing your recommendation…</span>
          </div>
        )}

        {!loading && report && (
          <>
            {/* Hero recommendation */}
            <div className="card-elevated p-7 lg:p-9 ring-1 ring-gold/30 bg-gradient-to-br from-card to-gold-light/30">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-gold" />
                <p className="text-[11px] tracking-[0.15em] uppercase text-gold font-body font-medium">
                  The headline
                </p>
              </div>
              <h2 className="heading-display text-2xl lg:text-3xl text-foreground leading-snug mb-3">
                {report.best_overall.headline}
              </h2>
              <p className="text-[14px] text-muted-foreground font-body leading-relaxed max-w-3xl">
                {report.best_overall.explanation}
              </p>
              {report.best_overall.proof_points.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-5">
                  {report.best_overall.proof_points.map((p, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-body bg-background/80 border border-border/50 px-2.5 py-1 rounded-full text-foreground/80"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Three supporting picks */}
            <div className="grid sm:grid-cols-3 gap-4">
              <PickCard
                icon={<Shield className="w-5 h-5 text-success" />}
                iconBg="bg-success/10"
                label="Safest offer"
                pick={report.safest}
                muted={!!sameTopPick}
                mutedNote={sameTopPick ? "Same buyer as your best overall — they're both your strongest and safest." : undefined}
              />
              <PickCard
                icon={<TrendingUp className="w-5 h-5 text-info" />}
                iconBg="bg-info/10"
                label="Highest offer"
                pick={report.highest}
              />
              <PickCard
                icon={<Target className="w-5 h-5 text-gold" />}
                iconBg="bg-gold-light"
                label="Best fit for seller"
                pick={report.best_fit}
              />
            </div>

            {/* Top Risks */}
            <div className="card-elevated p-6">
              <div className="flex items-center gap-2 mb-5">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <h3 className="heading-display text-lg font-semibold">Top risks to watch</h3>
              </div>
              <div className="space-y-4">
                {report.top_risks.map((risk, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 pb-4 border-b border-border/40 last:border-0 last:pb-0"
                  >
                    <span
                      className={`text-[10px] uppercase tracking-wider font-body font-medium px-2 py-0.5 rounded border ${severityChip[risk.severity]} flex-shrink-0 mt-0.5`}
                    >
                      {risk.severity}
                    </span>
                    <div className="flex-1">
                      <p className="text-[13px] font-body font-medium text-foreground mb-1">
                        {risk.title}
                      </p>
                      <p className="text-[13px] text-muted-foreground font-body leading-relaxed">
                        {risk.explanation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Negotiation Path */}
            <div className="card-elevated p-6">
              <h3 className="heading-display text-lg font-semibold mb-5">How we'd play this</h3>
              <ol className="space-y-5">
                {report.negotiation_path.map((step) => (
                  <li key={step.order} className="flex items-start gap-4">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary-foreground text-[12px] font-semibold">
                        {step.order}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-body font-semibold text-foreground mb-1">
                        {step.headline}
                      </p>
                      <p className="text-[13px] text-muted-foreground font-body leading-relaxed">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Suggested Counter */}
            {report.suggested_counter && (
              <div className="card-elevated p-6 border-l-4 border-l-accent">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-accent" />
                  <p className="text-[11px] tracking-[0.15em] uppercase text-accent font-body font-medium">
                    Suggested counter
                  </p>
                </div>
                <h3 className="heading-display text-xl font-semibold mb-3">
                  {report.suggested_counter.headline}
                </h3>
                <p className="text-[13px] text-muted-foreground font-body leading-relaxed mb-4">
                  {report.suggested_counter.rationale}
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">
                      Acceptance likelihood
                    </p>
                    <p className="heading-display text-2xl text-foreground">
                      {report.suggested_counter.acceptance_likelihood}%
                    </p>
                  </div>
                  <Link
                    to="/counter-strategy"
                    className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-[13px] font-medium font-body hover:opacity-90 transition-opacity"
                  >
                    View full counter strategy <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}

            {/* Bottom line */}
            <div className="card-elevated p-7 bg-muted/20">
              <div className="flex items-start gap-4">
                <Quote className="w-6 h-6 text-muted-foreground/40 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="heading-display text-lg font-semibold mb-2">The bottom line</h3>
                  <p className="text-[14px] text-foreground/90 font-body leading-relaxed">
                    {report.bottom_line}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function PickCard({
  icon,
  iconBg,
  label,
  pick,
  muted,
  mutedNote,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  pick: { buyer_name: string; offer_price: number; explanation: string; proof_points: string[] };
  muted?: boolean;
  mutedNote?: string;
}) {
  return (
    <div className={`card-elevated p-5 ${muted ? "opacity-80" : ""}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">
            {label}
          </p>
          <p className="text-[14px] font-semibold font-body text-foreground truncate">
            {pick.buyer_name}
          </p>
        </div>
      </div>
      <p className="text-[12.5px] text-muted-foreground font-body leading-relaxed">
        {muted && mutedNote ? mutedNote : pick.explanation}
      </p>
      {!muted && pick.proof_points.length > 0 && (
        <ul className="mt-3 space-y-1">
          {pick.proof_points.slice(0, 3).map((p, i) => (
            <li key={i} className="text-[11.5px] text-foreground/70 font-body flex items-start gap-1.5">
              <span className="text-success mt-1">·</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}