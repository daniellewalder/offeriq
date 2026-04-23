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
import SharePortalCard from "@/components/SharePortalCard";

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
      <div className="max-w-5xl mx-auto space-y-10 animate-fade-in">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap pb-6 border-b border-border/70">
          <div>
            <p className="eyebrow mb-4">Recommendation Report</p>
            <h1 className="text-display-lg text-foreground">
              The deal, distilled.
            </h1>
            <p className="text-[13px] text-muted-foreground font-body mt-3 tracking-wide">
              {propertyAddress} · {offerCount} offer{offerCount === 1 ? "" : "s"} analyzed · prepared {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="btn-secondary no-print"
          >
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>

        {usingDemo && !loading && (
          <div className="rounded-md border border-border/70 bg-surface-2 px-4 py-2.5 text-[12px] text-muted-foreground font-body tracking-wide">
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
            {/* Share with seller */}
            <SharePortalCard propertyAddress={propertyAddress} />

            {/* Hero recommendation */}
            <div className="card-feature p-8 lg:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-gold opacity-[0.04] rounded-full blur-3xl" />
              <div className="flex items-center gap-2 mb-5 relative">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <p className="text-[10.5px] tracking-[0.22em] uppercase text-accent font-body font-medium">
                  The headline recommendation
                </p>
              </div>
              <h2 className="heading-display text-3xl lg:text-[2.5rem] text-foreground leading-[1.1] mb-5 max-w-3xl tracking-editorial">
                {report.best_overall.headline}
              </h2>
              <p className="text-[15px] text-foreground/75 font-body leading-[1.7] max-w-3xl">
                {report.best_overall.explanation}
              </p>
              {report.best_overall.proof_points.length > 0 && (
                <>
                  <div className="rule-hairline my-7 max-w-3xl" />
                  <div className="flex flex-wrap gap-x-6 gap-y-3 max-w-3xl">
                    {report.best_overall.proof_points.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px] font-body text-foreground/70">
                        <span className="w-1 h-1 rounded-full bg-accent" />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Three supporting picks */}
            <div>
              <p className="eyebrow mb-5">Supporting analysis</p>
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
            </div>

            {/* Top Risks */}
            <div className="card-elevated p-7 lg:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="eyebrow-plain mb-2">Diligence</p>
                  <h3 className="text-display-sm">Top risks to watch</h3>
                </div>
                <AlertTriangle className="w-4 h-4 text-warning" />
              </div>
              <div className="space-y-5">
                {report.top_risks.map((risk, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-5 pb-5 border-b border-border/50 last:border-0 last:pb-0"
                  >
                    <span
                      className={`text-[9.5px] uppercase tracking-[0.16em] font-body font-medium px-2 py-[3px] rounded border ${severityChip[risk.severity]} flex-shrink-0 mt-0.5 min-w-[60px] text-center`}
                    >
                      {risk.severity}
                    </span>
                    <div className="flex-1">
                      <p className="text-[13.5px] font-body font-medium text-foreground mb-1.5">
                        {risk.title}
                      </p>
                      <p className="text-[13px] text-muted-foreground font-body leading-[1.65]">
                        {risk.explanation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Negotiation Path */}
            <div className="card-elevated p-7 lg:p-8">
              <p className="eyebrow-plain mb-2">Strategy</p>
              <h3 className="text-display-sm mb-7">How we'd play this</h3>
              <ol className="space-y-6">
                {report.negotiation_path.map((step) => (
                  <li key={step.order} className="flex items-start gap-5">
                    <div className="flex-shrink-0 mt-0.5 relative">
                      <div className="w-9 h-9 rounded-full bg-card border border-border-strong flex items-center justify-center shadow-xs">
                        <span className="heading-display text-[15px] text-foreground tabular-nums">
                          {step.order}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-[14px] font-body font-medium text-foreground mb-1.5">
                        {step.headline}
                      </p>
                      <p className="text-[13px] text-muted-foreground font-body leading-[1.7]">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Suggested Counter */}
            {report.suggested_counter && (
              <div className="card-ink p-8 lg:p-10 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-gold opacity-10 rounded-full blur-3xl" />
                <div className="flex items-center gap-2 mb-3 relative">
                  <Award className="w-3.5 h-3.5 text-accent" />
                  <p className="text-[10.5px] tracking-[0.22em] uppercase text-accent font-body font-medium">
                    Suggested counter
                  </p>
                </div>
                <h3 className="heading-display text-2xl lg:text-3xl mb-4 max-w-3xl text-primary-foreground leading-[1.15]">
                  {report.suggested_counter.headline}
                </h3>
                <p className="text-[14px] text-primary-foreground/70 font-body leading-[1.7] mb-7 max-w-3xl">
                  {report.suggested_counter.rationale}
                </p>
                <div className="flex items-end gap-8 flex-wrap">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-primary-foreground/50 font-body mb-2">
                      Acceptance likelihood
                    </p>
                    <p className="score-numeral text-primary-foreground">
                      {report.suggested_counter.acceptance_likelihood}%
                    </p>
                  </div>
                  <div className="h-12 w-px bg-primary-foreground/15 hidden sm:block" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-primary-foreground/50 font-body mb-2">
                      Counter target
                    </p>
                    <p className="text-[14px] font-body text-primary-foreground tabular-nums">
                      {report.suggested_counter.target_buyer}
                    </p>
                  </div>
                  <Link
                    to="/counter-strategy"
                    className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-gold text-accent-foreground rounded-md text-[12.5px] font-medium font-body tracking-wide hover:shadow-md transition-all"
                  >
                    View full counter strategy <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}

            {/* Bottom line */}
            <div className="card-paper p-8 lg:p-10">
              <div className="flex items-start gap-5">
                <Quote className="w-7 h-7 text-accent/40 flex-shrink-0 mt-1" strokeWidth={1.25} />
                <div className="flex-1">
                  <p className="eyebrow-plain mb-2">In summary</p>
                  <h3 className="text-display-sm mb-4">The bottom line</h3>
                  <p className="text-[15px] text-foreground/85 font-body leading-[1.75] italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400, fontSize: '1.125rem', fontStyle: 'italic' }}>
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
    <div className={`card-paper p-6 h-full flex flex-col ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between mb-5">
        <p className="label-key">{label}</p>
        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <h4 className="heading-display text-xl text-foreground mb-1 leading-tight">{pick.buyer_name}</h4>
      <p className="text-[13px] text-muted-foreground font-body tabular-nums mb-4">
        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(pick.offer_price)}
      </p>
      <div className="rule-hairline mb-4" />
      <p className="text-[12.5px] text-foreground/75 font-body leading-[1.7] flex-1">
        {muted && mutedNote ? mutedNote : pick.explanation}
      </p>
      {!muted && pick.proof_points.length > 0 && (
        <ul className="mt-4 pt-4 border-t border-border/60 space-y-1.5">
          {pick.proof_points.slice(0, 3).map((p, i) => (
            <li key={i} className="text-[11.5px] text-foreground/65 font-body flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-accent mt-[7px] flex-shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}