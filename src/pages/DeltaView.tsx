import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { sampleProperty } from "@/data/sampleData";
import {
  Loader2,
  TrendingUp,
  Clock,
  ShieldCheck,
  Wallet,
  Home as HomeIcon,
  FileCheck,
  Zap,
  Lock,
  ArrowRight,
  Target,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLatestAnalysisForUser,
  fetchOffersWithExtraction,
  fetchLatestRiskScores,
  fetchSellerPriorities,
  type SellerPriorityWeights,
} from "@/lib/offerService";
import { adaptOffer } from "@/lib/offerAdapter";
import { computeScores, type ScoredOffer } from "@/lib/scoringEngine";
import {
  computeDeltas,
  deriveTargetFromPriorities,
  type OfferDelta,
  type DimensionDelta,
  type DeltaDimension,
  type Movability,
  type Sentiment,
  type SellerTarget,
} from "@/lib/deltaEngine";

const dimensionIcons: Record<DeltaDimension, typeof TrendingUp> = {
  price: TrendingUp,
  timing: Clock,
  contingencies: ShieldCheck,
  concessions: Wallet,
  leaseback: HomeIcon,
  financing_certainty: FileCheck,
};

const sentimentBar: Record<Sentiment, string> = {
  exceeds: "bg-success",
  meets: "bg-info",
  gap: "bg-warning",
  large_gap: "bg-destructive",
};

const sentimentText: Record<Sentiment, string> = {
  exceeds: "text-success",
  meets: "text-info",
  gap: "text-warning",
  large_gap: "text-destructive",
};

const movabilityStyle: Record<Movability, { label: string; cls: string; Icon: typeof Zap }> = {
  easy: { label: "Easy to move", cls: "badge-success", Icon: Zap },
  moderate: { label: "Moderate lift", cls: "badge-info", Icon: ArrowRight },
  hard: { label: "Hard to move", cls: "badge-warning", Icon: Target },
  locked: { label: "Locked in", cls: "bg-muted text-muted-foreground px-2 py-0.5 rounded-sm text-[10px] font-medium", Icon: Lock },
};

export default function DeltaView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [deltas, setDeltas] = useState<OfferDelta[]>([]);
  const [target, setTarget] = useState<SellerTarget | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let listingPrice = sampleProperty.listingPrice;
        let offers = sampleProperty.offers;
        let scoresMap: Record<string, ScoredOffer | undefined> = {};
        let priorities: SellerPriorityWeights | null = null;
        let demo = true;

        if (user) {
          const analysis = await fetchLatestAnalysisForUser(user.id);
          if (analysis) {
            const property = (analysis as any).properties;
            if (property) listingPrice = Number(property.listing_price ?? listingPrice);

            const rows = await fetchOffersWithExtraction(analysis.id);
            if (rows.length > 0) {
              offers = rows.map((r) => adaptOffer(r, listingPrice));
              demo = false;
              const persisted = await fetchLatestRiskScores(offers.map((o) => o.id));
              for (const o of offers) {
                scoresMap[o.id] = persisted[o.id]
                  ? hydrateScored(persisted[o.id])
                  : computeScores(o, listingPrice);
              }
            }

            const p = await fetchSellerPriorities(user.id, analysis.id);
            if (p) {
              priorities = {
                price_weight: p.price_weight ?? 80,
                certainty_weight: p.certainty_weight ?? 70,
                contingencies_weight: p.contingencies_weight ?? 60,
                speed_weight: p.speed_weight ?? 50,
                leaseback_weight: p.leaseback_weight ?? 30,
                repair_weight: p.repair_weight ?? 40,
                financial_weight: p.financial_weight ?? 65,
              };
            }
          }
        }

        if (demo) {
          for (const o of offers) scoresMap[o.id] = computeScores(o, listingPrice);
        }

        const t = deriveTargetFromPriorities(listingPrice, priorities);
        const result = computeDeltas(offers, t, scoresMap);

        if (!active) return;
        setTarget(t);
        setDeltas(result);
        setUsingDemo(demo);
        setSelectedId(result[0]?.offer_id ?? null);
      } catch (err: any) {
        toast({
          title: "Could not load delta view",
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

  const selected = useMemo(
    () => deltas.find((d) => d.offer_id === selectedId) ?? deltas[0] ?? null,
    [deltas, selectedId],
  );

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">
            Negotiation Command Center
          </p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">
            Delta View
          </h1>
          <p className="text-[13px] text-muted-foreground font-body mt-2 max-w-2xl">
            The gap between every incoming offer and the seller's desired outcome,
            sorted by how easy it is to close. Easy moves first; locked terms last.
          </p>
        </div>

        {usingDemo && !loading && (
          <div className="rounded-md border border-border/50 bg-muted/30 px-4 py-2.5 text-[12px] text-muted-foreground font-body">
            Showing demo data. Run an analysis with real offers to see your own deltas.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-[13px] font-body">Computing deltas…</span>
          </div>
        )}

        {!loading && target && (
          <>
            {/* Seller target band */}
            <div className="rounded-md border border-accent/30 bg-accent/[0.03] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-accent" strokeWidth={1.5} />
                <p className="text-[10px] tracking-[0.15em] uppercase text-accent font-body font-medium">
                  Seller's Desired Outcome
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <TargetCell label="Price" value={fmtUSD(target.price)} />
                <TargetCell label="Close" value={`${target.closeDays} days`} />
                <TargetCell
                  label="Contingencies"
                  value={target.maxContingencies === 0 ? "None" : `≤ ${target.maxContingencies}`}
                />
                <TargetCell label="Concessions" value={target.maxConcessionsUSD === 0 ? "$0" : fmtUSD(target.maxConcessionsUSD)} />
                <TargetCell label="Leaseback" value={target.leaseback} />
                <TargetCell label="Financing" value={`≥ ${target.financingCertaintyMin}/100`} />
              </div>
            </div>

            {/* Cross-offer alignment scoreboard */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">
                  Alignment Scoreboard
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {deltas.map((d) => (
                  <button
                    key={d.offer_id}
                    onClick={() => setSelectedId(d.offer_id)}
                    className={`text-left rounded-md border p-4 transition-all ${
                      selected?.offer_id === d.offer_id
                        ? "border-accent/50 bg-card shadow-sm"
                        : "border-border/40 bg-card hover:border-border"
                    }`}
                  >
                    <p className="text-[12px] font-medium font-body text-foreground truncate">
                      {d.buyer_name}
                    </p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="heading-display text-2xl text-foreground">
                        {d.alignment_score}
                      </span>
                      <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body">
                        / 100 aligned
                      </span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full ${alignmentBar(d.alignment_score)}`}
                        style={{ width: `${d.alignment_score}%` }}
                      />
                    </div>
                    <DimensionStrip dimensions={d.dimensions} />
                  </button>
                ))}
              </div>
            </div>

            {/* Selected offer detail */}
            {selected && <OfferDeltaDetail data={selected} />}
          </>
        )}
      </div>
    </AppLayout>
  );
}

/* ── Subcomponents ── */

function TargetCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium mb-0.5">
        {label}
      </p>
      <p className="text-[13px] font-body text-foreground font-medium leading-snug">
        {value}
      </p>
    </div>
  );
}

function DimensionStrip({ dimensions }: { dimensions: DimensionDelta[] }) {
  return (
    <div className="flex gap-1 mt-3">
      {dimensions.map((d) => (
        <div
          key={d.dimension}
          className={`h-1.5 flex-1 rounded-full ${sentimentBar[d.sentiment]}`}
          title={`${d.label}: ${d.actual}`}
        />
      ))}
    </div>
  );
}

function OfferDeltaDetail({ data }: { data: OfferDelta }) {
  return (
    <div className="rounded-md border border-border/50 bg-card overflow-hidden">
      <div className="px-6 py-5 border-b border-border/40 flex items-center justify-between">
        <div>
          <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-1">
            Negotiation Delta
          </p>
          <p className="text-[16px] font-medium font-body text-foreground">
            {data.buyer_name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body">
            Alignment
          </p>
          <p className={`text-2xl font-display ${alignmentText(data.alignment_score)}`}>
            {data.alignment_score}
            <span className="text-[11px] font-body text-muted-foreground ml-1">/ 100</span>
          </p>
        </div>
      </div>

      {/* Dimension grid */}
      <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/40">
        <div className="p-2">
          {data.dimensions.slice(0, 3).map((d) => (
            <DimensionRow key={d.dimension} d={d} />
          ))}
        </div>
        <div className="p-2">
          {data.dimensions.slice(3).map((d) => (
            <DimensionRow key={d.dimension} d={d} />
          ))}
        </div>
      </div>

      {/* Easiest / Hardest summary */}
      <div className="grid sm:grid-cols-2 gap-0 border-t border-border/40 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
        <MoveSummary
          title="Easiest moves"
          hint="Lowest-friction asks to bring this offer toward target."
          items={data.easiest_moves}
          accent="success"
          Icon={Zap}
        />
        <MoveSummary
          title="Hardest to move"
          hint="Locked-in or expensive to shift — accept or walk."
          items={data.hardest_moves}
          accent="warning"
          Icon={Lock}
        />
      </div>
    </div>
  );
}

function DimensionRow({ d }: { d: DimensionDelta }) {
  const Icon = dimensionIcons[d.dimension];
  const mov = movabilityStyle[d.movability];
  const MovIcon = mov.Icon;
  const score = Math.round(50 + d.delta_score / 2);

  return (
    <div className="px-4 py-4 border-b border-border/30 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className="text-[12px] font-medium font-body text-foreground">
              {d.label}
            </p>
            <span className={`flex items-center gap-1 ${mov.cls}`}>
              <MovIcon className="w-2.5 h-2.5" strokeWidth={2} />
              {mov.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[12px] font-body">
            <span className="text-muted-foreground">{d.desired}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
            <span className={`font-medium ${sentimentText[d.sentiment]}`}>
              {d.actual}
            </span>
            {d.delta_label && (
              <span className="text-[11px] text-muted-foreground/80 ml-1">
                · {d.delta_label}
              </span>
            )}
          </div>

          {/* Sentiment bar */}
          <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all ${sentimentBar[d.sentiment]}`}
              style={{ width: `${Math.max(6, Math.min(100, score))}%` }}
            />
          </div>

          <p className="text-[11px] text-muted-foreground font-body mt-2 leading-relaxed">
            {d.rationale}
          </p>
          <p className="text-[11px] text-foreground/80 font-body mt-1.5 leading-relaxed">
            <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-medium mr-1.5">
              Move
            </span>
            {d.move}
          </p>
        </div>
      </div>
    </div>
  );
}

function MoveSummary({
  title,
  hint,
  items,
  accent,
  Icon,
}: {
  title: string;
  hint: string;
  items: DimensionDelta[];
  accent: "success" | "warning";
  Icon: typeof Zap;
}) {
  const accentText = accent === "success" ? "text-success" : "text-warning";
  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${accentText}`} strokeWidth={1.5} />
        <p className={`text-[10px] tracking-[0.15em] uppercase font-body font-medium ${accentText}`}>
          {title}
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground font-body mb-3">{hint}</p>
      {items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground font-body italic">
          Nothing in this bucket.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((d) => (
            <div
              key={d.dimension}
              className="rounded-sm border border-border/40 bg-background/40 p-3"
            >
              <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body mb-1">
                {d.label}
              </p>
              <p className="text-[12px] font-body text-foreground leading-snug">
                {d.move}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Helpers ── */

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function alignmentBar(score: number) {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-info";
  if (score >= 40) return "bg-warning";
  return "bg-destructive";
}
function alignmentText(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-info";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}

function hydrateScored(row: any): ScoredOffer {
  const wrap = (s: number) => ({ score: Number(s ?? 50), factors: [], summary: "" });
  return {
    offerStrength: wrap(row.offer_strength),
    closeProbability: wrap(row.close_probability),
    financialConfidence: wrap(row.financial_confidence),
    contingencyRisk: wrap(row.contingency_risk),
    timingRisk: wrap(row.timing_risk),
    packageCompleteness: wrap(row.package_completeness),
  };
}
