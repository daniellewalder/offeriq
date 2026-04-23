import AppLayout from "@/components/AppLayout";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  CheckCircle2,
  Sparkles,
  Zap,
  Target,
  Home as HomeIcon,
  Clock,
  DollarSign,
  ShieldCheck,
  TrendingDown,
  Wrench,
  BadgeCheck,
  FileCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { sampleProperty, formatCurrency } from "@/data/sampleData";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLatestAnalysisForUser,
  fetchOffersWithExtraction,
  fetchLatestLeverageSuggestions,
  saveLeverageSuggestions,
} from "@/lib/offerService";
import { adaptOffer } from "@/lib/offerAdapter";
import {
  generateLeverage,
  type LeverageSuggestion,
  type LeverageCategory,
  type LeverageTag,
} from "@/lib/leverageEngine";

/* ── Visuals ── */
const categoryIcons: Record<LeverageCategory, typeof HomeIcon> = {
  leaseback: HomeIcon,
  timing: Clock,
  deposit: DollarSign,
  contingency: ShieldCheck,
  appraisal: TrendingDown,
  repair: Wrench,
  concession: BadgeCheck,
  financing: FileCheck,
};
const categoryLabels: Record<LeverageCategory, string> = {
  leaseback: "Leaseback",
  timing: "Timing",
  deposit: "Deposit",
  contingency: "Contingency",
  appraisal: "Appraisal",
  repair: "Repairs",
  concession: "Concessions",
  financing: "Financing",
};

const tagStyles: Record<LeverageTag, string> = {
  "High Seller Impact": "badge-gold",
  "Low Buyer Friction": "badge-success",
  "Strong Counter Candidate": "badge-warning",
  "Likely Acceptance Booster": "badge-info",
};

const meterColor = (score: number, inverse = false) => {
  const s = inverse ? 100 - score : score;
  if (s >= 70) return "bg-success";
  if (s >= 40) return "bg-info";
  return "bg-muted-foreground/40";
};

interface OfferGroup {
  offerId: string;
  buyerName: string;
  offerPrice: number;
  suggestions: LeverageSuggestion[];
}

export default function Leverage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dealAnalysisId, setDealAnalysisId] = useState<string | null>(null);
  const [groups, setGroups] = useState<OfferGroup[]>([]);
  const [easiestWins, setEasiestWins] = useState<LeverageSuggestion[]>([]);
  const [highestImpact, setHighestImpact] = useState<LeverageSuggestion[]>([]);
  const [openOffer, setOpenOffer] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);

  /* ── Load real (or demo) offers and compute suggestions ── */
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let listingPrice = sampleProperty.listingPrice;
        let goals: string[] = sampleProperty.sellerGoals;
        let offers = sampleProperty.offers;
        let analysisId: string | null = null;
        let demo = true;

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
              demo = false;
            }

            // Hydrate previously saved suggestions if present
            const saved = await fetchLatestLeverageSuggestions(analysis.id);
            if (saved && Array.isArray((saved as any).suggestions)) {
              const existing = (saved as any).suggestions as LeverageSuggestion[];
              const grouped = groupByOffer(existing, offers);
              if (active) {
                setGroups(grouped);
                setEasiestWins(((saved as any).easiest_wins ?? []) as LeverageSuggestion[]);
                setHighestImpact(
                  ((saved as any).highest_impact_terms ?? []) as LeverageSuggestion[],
                );
                setSavedAt(new Date((saved as any).generated_at));
              }
            }
          }
        }

        const result = generateLeverage(offers, { listingPrice, goals });

        if (!active) return;
        setDealAnalysisId(analysisId);
        setUsingDemo(demo);
        // Only overwrite groups if we didn't hydrate saved ones
        setGroups((prev) =>
          prev.length > 0 ? prev : groupByOffer(result.suggestions, offers),
        );
        setEasiestWins((prev) => (prev.length > 0 ? prev : result.easiest_wins));
        setHighestImpact((prev) =>
          prev.length > 0 ? prev : result.highest_impact_terms,
        );
        // Default-open first offer
        const first = offers[0];
        if (first) setOpenOffer((cur) => cur ?? first.id);
      } catch (err: any) {
        toast({
          title: "Could not load leverage data",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allSuggestions = useMemo(
    () => groups.flatMap((g) => g.suggestions),
    [groups],
  );

  const handleSave = async () => {
    if (!dealAnalysisId) {
      toast({
        title: "Sign in to save",
        description: "Suggestions persist once you have an active deal analysis.",
      });
      return;
    }
    setSaving(true);
    try {
      const v = await saveLeverageSuggestions(dealAnalysisId, {
        suggestions: allSuggestions,
        easiest_wins: easiestWins,
        highest_impact_terms: highestImpact,
        notes: "Generated by rules engine",
      });
      setSavedAt(new Date());
      toast({
        title: "Suggestions saved",
        description: `Stored as version ${v}.`,
      });
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
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">
              Negotiation
            </p>
            <h1 className="heading-display text-3xl lg:text-4xl text-foreground">
              Leverage Points
            </h1>
            <p className="text-[13px] text-muted-foreground font-body mt-2 max-w-2xl">
              Per-offer terms where a small ask creates outsized seller value with low
              buyer friction. Tagged for fast triage and ready to copy into a counter.
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
              disabled={saving || loading || allSuggestions.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-[12px] font-body font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saving ? "Saving…" : "Save suggestions"}
            </button>
          </div>
        </div>

        {usingDemo && !loading && (
          <div className="rounded-md border border-border/50 bg-muted/30 px-4 py-2.5 text-[12px] text-muted-foreground font-body">
            Showing demo data. Run an analysis with real offers to generate
            leverage from your own extracted fields.
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-[13px] font-body">Generating leverage suggestions…</span>
          </div>
        )}

        {!loading && (
          <>
            {/* Top-line: easiest wins + highest impact */}
            <div className="grid lg:grid-cols-2 gap-4">
              <SummaryColumn
                title="Easiest Wins"
                hint="Lowest buyer friction. Counter-ask first."
                Icon={Zap}
                accent="text-success"
                bg="bg-success/[0.04] border-success/20"
                items={easiestWins}
              />
              <SummaryColumn
                title="Highest Impact Terms"
                hint="Biggest seller value if accepted."
                Icon={Target}
                accent="text-accent"
                bg="bg-accent/[0.04] border-accent/20"
                items={highestImpact}
              />
            </div>

            {/* Per-offer groups */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">
                  Per-Offer Suggestions
                </p>
              </div>

              {groups.length === 0 && (
                <div className="rounded-md border border-border/40 p-8 text-center text-[13px] text-muted-foreground font-body">
                  No offers found. Add offers and run extraction to surface
                  leverage opportunities.
                </div>
              )}

              {groups.map((g) => {
                const isOpen = openOffer === g.offerId;
                return (
                  <div
                    key={g.offerId}
                    className="rounded-md border border-border/50 bg-card overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenOffer(isOpen ? null : g.offerId)}
                      className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-[14px] font-medium font-body text-foreground">
                            {g.buyerName}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                            {formatCurrency(g.offerPrice)} · {g.suggestions.length}{" "}
                            suggestion{g.suggestions.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <TagSummary suggestions={g.suggestions} />
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 space-y-2 animate-fade-in">
                        <div className="border-t border-border/40 -mx-5 mb-3" />
                        {g.suggestions.length === 0 && (
                          <p className="text-[12px] text-muted-foreground font-body py-3">
                            No high-leverage suggestions for this offer — terms are
                            already tight.
                          </p>
                        )}
                        {g.suggestions.map((s) => (
                          <SuggestionCard
                            key={s.id}
                            s={s}
                            open={openCard === s.id}
                            onToggle={() =>
                              setOpenCard(openCard === s.id ? null : s.id)
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

/* ── Subcomponents ── */

function SummaryColumn({
  title,
  hint,
  Icon,
  accent,
  bg,
  items,
}: {
  title: string;
  hint: string;
  Icon: typeof Zap;
  accent: string;
  bg: string;
  items: LeverageSuggestion[];
}) {
  return (
    <div className={`rounded-md border ${bg} p-5`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${accent}`} strokeWidth={1.5} />
        <p className={`text-[10px] tracking-[0.15em] uppercase ${accent} font-body font-medium`}>
          {title}
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground font-body mb-4">{hint}</p>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-[12px] text-muted-foreground font-body italic">
            Nothing to surface yet.
          </p>
        )}
        {items.map((s) => (
          <div
            key={s.id}
            className="rounded-sm border border-border/40 bg-background/40 p-3"
          >
            <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body mb-1">
              {s.buyer_name} · {categoryLabels[s.category]}
            </p>
            <p className="text-[12px] font-body text-foreground leading-snug">
              {s.term}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagSummary({ suggestions }: { suggestions: LeverageSuggestion[] }) {
  const counts: Partial<Record<LeverageTag, number>> = {};
  suggestions.forEach((s) =>
    s.tags.forEach((t) => (counts[t] = (counts[t] ?? 0) + 1)),
  );
  const entries = Object.entries(counts) as [LeverageTag, number][];
  if (entries.length === 0) return null;
  return (
    <div className="hidden md:flex items-center gap-1.5">
      {entries.map(([tag, n]) => (
        <span key={tag} className={`${tagStyles[tag]} text-[10px]`}>
          {tag} · {n}
        </span>
      ))}
    </div>
  );
}

function SuggestionCard({
  s,
  open,
  onToggle,
}: {
  s: LeverageSuggestion;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = categoryIcons[s.category];
  return (
    <div className="rounded-md border border-border/40 bg-background/30">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start gap-3"
      >
        <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">
              {categoryLabels[s.category]}
            </span>
          </div>
          <p className="text-[13px] font-medium font-body text-foreground leading-snug">
            {s.term}
          </p>
          <p className="text-[12px] text-muted-foreground font-body mt-1 leading-relaxed">
            {s.headline}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {s.tags.map((t) => (
              <span key={t} className={tagStyles[t]}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="hidden sm:flex flex-col gap-2 items-end flex-shrink-0 w-32">
          <Meter label="Seller value" score={s.seller_impact_score} />
          <Meter label="Buyer friction" score={s.buyer_friction_score} inverse />
        </div>
        <div className="flex-shrink-0 mt-1">
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pl-14 space-y-3 animate-fade-in">
          <div>
            <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium mb-1.5">
              Why this works
            </p>
            <p className="text-[12px] text-muted-foreground font-body leading-relaxed">
              {s.reasoning}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="rounded-sm border border-success/20 bg-success/[0.03] p-3">
              <p className="text-[10px] tracking-[0.1em] uppercase text-success font-body font-medium mb-1">
                Seller gets
              </p>
              <p className="text-[12px] font-body text-foreground">{s.seller_gets}</p>
            </div>
            <div className="rounded-sm border border-border/50 bg-muted/20 p-3">
              <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium mb-1">
                Buyer gives
              </p>
              <p className="text-[12px] font-body text-foreground">{s.buyer_gives}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Meter({
  label,
  score,
  inverse = false,
}: {
  label: string;
  score: number;
  inverse?: boolean;
}) {
  return (
    <div className="w-full">
      <p className="text-[9px] tracking-[0.1em] uppercase text-muted-foreground font-body mb-0.5">
        {label}
      </p>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${meterColor(score, inverse)}`}
          style={{ width: `${Math.max(8, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
}

/* ── Helpers ── */

function groupByOffer(
  suggestions: LeverageSuggestion[],
  offers: { id: string; buyerName: string; offerPrice: number }[],
): OfferGroup[] {
  return offers.map((o) => ({
    offerId: o.id,
    buyerName: o.buyerName,
    offerPrice: o.offerPrice,
    suggestions: suggestions.filter((s) => s.offer_id === o.id),
  }));
}
