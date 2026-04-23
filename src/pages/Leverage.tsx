import AppLayout from '@/components/AppLayout';
import { ArrowRight, Home, Clock, DollarSign, ShieldCheck, FileX, Wrench, BadgeCheck, TrendingDown, ChevronDown, ChevronUp, Brain, Loader2, RefreshCw, Sparkles, Zap, Target } from 'lucide-react';
import { useState } from 'react';
import { sampleProperty, formatCurrency } from '@/data/sampleData';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/* ── Types ── */
type Impact = 'critical' | 'high' | 'moderate';
type Friction = 'none' | 'low' | 'moderate';
type Category = 'leaseback' | 'timing' | 'deposit' | 'contingency' | 'appraisal' | 'repair' | 'concession';

interface LeveragePoint {
  category: Category;
  title: string;
  oneLiner: string;
  reasoning: string;
  sellerImpact: Impact;
  buyerFriction: Friction;
  tags: string[];
  applicableTo: string[];
  sellerGets: string;
  buyerGives: string;
}

/* ── Data ── */
const leveragePoints: LeveragePoint[] = [
  {
    category: 'leaseback',
    title: 'Trade a rent-free leaseback for a firmer price',
    oneLiner: 'Offer 7–14 days of post-close occupancy — it costs the buyer almost nothing but gives you real pricing leverage.',
    reasoning: 'In luxury deals, a short rent-free leaseback is one of the most lopsided trades available. The buyer absorbs a rounding error on carrying costs, but the seller gains the flexibility to hold firm on price, reduce concessions, or both. It\'s a concession that feels generous to the buyer and costs you nothing materially.',
    sellerImpact: 'critical',
    buyerFriction: 'none',
    tags: ['Pricing Leverage', 'Easy Win', 'Proven Tactic'],
    applicableTo: ['offer-b', 'offer-e'],
    sellerGets: 'Stronger negotiating position on price and concessions',
    buyerGives: '7–14 days of post-close occupancy (minimal cost)',
  },
  {
    category: 'contingency',
    title: 'Tighten the inspection window to 5–7 days',
    oneLiner: 'Serious buyers on well-maintained properties don\'t need 17 days to decide. Shorter windows mean less renegotiation risk.',
    reasoning: 'A 17-day inspection period on a well-maintained Bel Air property is leaving the door wide open for renegotiation. At this level, buyers know what they\'re getting into — a 5–7 day window is standard for luxury transactions. It signals you expect commitment and shrinks the period where minor findings get weaponized into price reductions. Buyers who push back hard on this are often planning to renegotiate regardless.',
    sellerImpact: 'critical',
    buyerFriction: 'low',
    tags: ['Risk Reduction', 'Signals Strength', 'Counter Essential'],
    applicableTo: ['offer-b', 'offer-d', 'offer-e'],
    sellerGets: 'Dramatically reduced renegotiation exposure',
    buyerGives: 'Faster inspection decision (5–7 days vs. 10–17)',
  },
  {
    category: 'deposit',
    title: 'Push earnest money to $250K–$300K',
    oneLiner: 'A bigger deposit costs qualified buyers nothing — it sits in escrow — but it makes walking away genuinely expensive.',
    reasoning: 'At the $9M price point, a $150K earnest money deposit is barely 1.6% of the purchase price. That doesn\'t create meaningful friction if the buyer decides to walk. Pushing to $250K–$300K puts real money at stake and signals the buyer is fully committed. The key insight: this costs a well-qualified buyer exactly zero — the money comes back at close. It\'s a pure commitment signal, and serious buyers have no reason to refuse.',
    sellerImpact: 'high',
    buyerFriction: 'none',
    tags: ['Commitment Test', 'Zero Buyer Cost', 'Easy Ask'],
    applicableTo: ['offer-b', 'offer-d', 'offer-e'],
    sellerGets: 'Stronger contractual commitment, costly buyer exit',
    buyerGives: 'Larger refundable deposit held in escrow',
  },
  {
    category: 'timing',
    title: 'Give on close date, hold firm on everything else',
    oneLiner: 'Let the buyer have the timeline they want — then use that goodwill to hold on price, contingencies, and concessions.',
    reasoning: 'Nakamura wants 21 days. Westside wants 14. Instead of pushing back on their preferred timing, grant it — and use the goodwill to hold firm on price and contingencies. Buyers consistently overvalue certainty on their close date. You\'re giving them something that feels like a major concession but costs you nothing financially. Meanwhile, you maintain leverage on the terms that actually affect your net proceeds.',
    sellerImpact: 'high',
    buyerFriction: 'none',
    tags: ['Perceived Concession', 'Zero Cost', 'Goodwill Builder'],
    applicableTo: ['offer-a', 'offer-c'],
    sellerGets: 'Leverage to hold on price and contingency terms',
    buyerGives: 'Nothing — they get their preferred timeline',
  },
  {
    category: 'appraisal',
    title: 'Require appraisal gap coverage on financed offers',
    oneLiner: 'The #1 deal-killer in luxury markets is a low appraisal. The Kapoors already offered coverage — make it a requirement for everyone.',
    reasoning: 'In luxury real estate, appraisals routinely come in below contract price because comparable sales data is thin. When that happens with a financed offer, the deal either renegotiates or falls apart. The Kapoors already volunteered $200K in gap coverage — that\'s the kind of preparation that separates serious offers from aspirational ones. For the Chen and Ashford offers, requiring $150K–$200K in coverage isn\'t unreasonable. If a buyer can\'t commit to covering a potential gap, that tells you a lot about their financial ceiling and their willingness to fight for this property.',
    sellerImpact: 'critical',
    buyerFriction: 'moderate',
    tags: ['Deal Protection', 'Counter Essential', 'Market Reality'],
    applicableTo: ['offer-b', 'offer-d'],
    sellerGets: 'Protection against the most common financed-deal failure',
    buyerGives: 'Commitment to cover appraisal shortfall up to $200K',
  },
  {
    category: 'repair',
    title: 'Counter as sold as-is with a small price credit',
    oneLiner: 'Replace open-ended repair negotiations with a fixed credit — you know exactly what it costs and avoid weeks of back-and-forth.',
    reasoning: 'Post-inspection repair requests are where well-structured deals go sideways. A buyer finds $12K in cosmetic issues, asks for $30K in credits, and suddenly you\'re renegotiating the whole deal. Countering with "sold as-is" paired with a defined credit ($10K–$20K) gives the buyer something concrete while eliminating the uncertainty for you. You trade a known cost for the guarantee that no one comes back with a surprise list of repairs two weeks before close.',
    sellerImpact: 'high',
    buyerFriction: 'low',
    tags: ['Risk Reduction', 'Timeline Protection', 'Clean Close'],
    applicableTo: ['offer-b', 'offer-d'],
    sellerGets: 'No surprise repair demands, predictable costs',
    buyerGives: 'Accepts property condition in exchange for a defined credit',
  },
  {
    category: 'concession',
    title: 'Reject concession requests, offer a closing cost credit instead',
    oneLiner: 'Westside is asking for $50K in cosmetic credits. Reframe it as a smaller closing cost credit — same gesture, lower cost.',
    reasoning: 'Westside Holdings is requesting $50K for "cosmetic updates," which is a negotiation anchor, not a real number. Instead of engaging on their terms, counter with a $15K–$20K closing cost credit. It acknowledges their ask without accepting the frame. The buyer gets something to point to, and you avoid setting a precedent where concession requests balloon during the inspection period.',
    sellerImpact: 'moderate',
    buyerFriction: 'low',
    tags: ['Reframes the Ask', 'Saves $30K+', 'Smart Counter'],
    applicableTo: ['offer-c'],
    sellerGets: 'Saves $30K+ vs. the original concession request',
    buyerGives: 'Accepts smaller closing cost credit in lieu of repair credit',
  },
];

/* ── Styling maps ── */
const categoryIcons: Record<Category, typeof Home> = {
  leaseback: Home, timing: Clock, deposit: DollarSign, contingency: ShieldCheck,
  appraisal: TrendingDown, repair: Wrench, concession: BadgeCheck,
};
const categoryLabels: Record<Category, string> = {
  leaseback: 'Leaseback', timing: 'Timing', deposit: 'Deposit', contingency: 'Contingency',
  appraisal: 'Appraisal', repair: 'Repairs', concession: 'Concessions',
};

const impactStyles: Record<Impact, { label: string; bar: string; text: string }> = {
  critical: { label: 'Critical', bar: 'bg-accent', text: 'text-accent' },
  high: { label: 'High', bar: 'bg-success', text: 'text-success' },
  moderate: { label: 'Moderate', bar: 'bg-info', text: 'text-info' },
};
const frictionStyles: Record<Friction, { label: string; bar: string; text: string }> = {
  none: { label: 'None', bar: 'bg-success', text: 'text-success' },
  low: { label: 'Low', bar: 'bg-success/60', text: 'text-success' },
  moderate: { label: 'Moderate', bar: 'bg-warning', text: 'text-warning' },
};

const tagColorMap: Record<string, string> = {
  'Pricing Leverage': 'badge-gold', 'Easy Win': 'badge-success', 'Proven Tactic': 'badge-info',
  'Risk Reduction': 'badge-gold', 'Signals Strength': 'badge-info', 'Counter Essential': 'badge-warning',
  'Commitment Test': 'badge-gold', 'Zero Buyer Cost': 'badge-success', 'Easy Ask': 'badge-success',
  'Perceived Concession': 'badge-info', 'Zero Cost': 'badge-success', 'Goodwill Builder': 'badge-info',
  'Deal Protection': 'badge-gold', 'Market Reality': 'badge-warning',
  'Timeline Protection': 'badge-info', 'Clean Close': 'badge-success',
  'Reframes the Ask': 'badge-info', 'Saves $30K+': 'badge-gold', 'Smart Counter': 'badge-info',
};

const buyerName = (id: string) => sampleProperty.offers.find(o => o.id === id)?.buyerName ?? id;

/* ── Component ── */
export default function Leverage() {
  const [expanded, setExpanded] = useState<number | null>(0);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { toast } = useToast();

  const runAiLeverage = async () => {
    setAiLoading(true);
    try {
      const offersPayload = sampleProperty.offers.map(o => ({
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
        close_probability: o.scores.closeProbability,
        financial_confidence: o.scores.financialConfidence,
        contingency_risk: o.scores.contingencyRisk,
      }));

      const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-leverage`, {
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
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Negotiation</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Leverage Points</h1>
          <p className="text-[13px] text-muted-foreground font-body mt-2 max-w-2xl">
            Terms where a small seller concession — or a smart counter-ask — creates outsized value. Ranked by seller impact relative to buyer friction.
          </p>
        </div>

        {/* Impact / Friction Legend */}
        <div className="flex flex-wrap gap-6 text-[11px] font-body text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="tracking-[0.1em] uppercase font-medium">Seller Impact</span>
            {(['critical', 'high', 'moderate'] as Impact[]).map(i => (
              <span key={i} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${impactStyles[i].bar}`} />
                {impactStyles[i].label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="tracking-[0.1em] uppercase font-medium">Buyer Friction</span>
            {(['none', 'low', 'moderate'] as Friction[]).map(f => (
              <span key={f} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${frictionStyles[f].bar}`} />
                {frictionStyles[f].label}
              </span>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {leveragePoints.map((lp, i) => {
            const isOpen = expanded === i;
            const CatIcon = categoryIcons[lp.category];
            const impact = impactStyles[lp.sellerImpact];
            const friction = frictionStyles[lp.buyerFriction];

            return (
              <div
                key={i}
                className={`rounded-md border transition-all duration-300 ${isOpen ? 'border-border bg-card' : 'border-border/40 bg-card hover:border-border'}`}
              >
                {/* Collapsed header — always visible */}
                <button
                  onClick={() => setExpanded(isOpen ? null : i)}
                  className="w-full text-left px-5 py-4 lg:px-6 lg:py-5 flex items-start gap-4"
                >
                  {/* Category icon */}
                  <div className={`w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${isOpen ? 'bg-accent/10' : 'bg-muted'}`}>
                    <CatIcon className={`w-4 h-4 ${isOpen ? 'text-accent' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                  </div>

                  {/* Title & one-liner */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">{categoryLabels[lp.category]}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${impact.bar}`} title={`Seller impact: ${impact.label}`} />
                    </div>
                    <h3 className="text-[14px] font-medium font-body text-foreground leading-snug">{lp.title}</h3>
                    <p className="text-[12px] text-muted-foreground font-body mt-1 leading-relaxed">{lp.oneLiner}</p>
                  </div>

                  {/* Impact & friction meters */}
                  <div className="hidden sm:flex items-center gap-5 flex-shrink-0 pt-1">
                    <div className="w-20">
                      <p className="text-[9px] tracking-[0.1em] uppercase text-muted-foreground font-body mb-1">Seller</p>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${impact.bar}`} style={{ width: lp.sellerImpact === 'critical' ? '100%' : lp.sellerImpact === 'high' ? '70%' : '45%' }} />
                      </div>
                      <p className={`text-[10px] font-body mt-0.5 ${impact.text}`}>{impact.label}</p>
                    </div>
                    <div className="w-20">
                      <p className="text-[9px] tracking-[0.1em] uppercase text-muted-foreground font-body mb-1">Friction</p>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${friction.bar}`} style={{ width: lp.buyerFriction === 'none' ? '8%' : lp.buyerFriction === 'low' ? '30%' : '60%' }} />
                      </div>
                      <p className={`text-[10px] font-body mt-0.5 ${friction.text}`}>{friction.label}</p>
                    </div>
                  </div>

                  {/* Chevron */}
                  <div className="flex-shrink-0 mt-1">
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-5 pb-5 lg:px-6 lg:pb-6 ml-13 space-y-5 animate-fade-in">
                    {/* Divider */}
                    <div className="border-t border-border/50" />

                    {/* Reasoning */}
                    <div>
                      <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium mb-2">Why This Works</p>
                      <p className="text-[13px] text-muted-foreground font-body leading-relaxed">{lp.reasoning}</p>
                    </div>

                    {/* Trade visual */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="rounded-md border border-success/20 bg-success/[0.03] p-4">
                        <p className="text-[10px] tracking-[0.1em] uppercase text-success font-body font-medium mb-1.5">Seller Gets</p>
                        <p className="text-[13px] font-body text-foreground">{lp.sellerGets}</p>
                      </div>
                      <div className="rounded-md border border-border/60 bg-muted/20 p-4">
                        <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium mb-1.5">Buyer Gives</p>
                        <p className="text-[13px] font-body text-foreground">{lp.buyerGives}</p>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {lp.tags.map(t => (
                        <span key={t} className={tagColorMap[t] ?? 'badge-info'}>{t}</span>
                      ))}
                    </div>

                    {/* Applicable offers */}
                    <div>
                      <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium mb-2">Best Applied To</p>
                      <div className="flex flex-wrap gap-2">
                        {lp.applicableTo.map(id => {
                          const offer = sampleProperty.offers.find(o => o.id === id);
                          if (!offer) return null;
                          return (
                            <div key={id} className="flex items-center gap-2 rounded-sm border border-border/50 bg-muted/30 px-3 py-2">
                              <span className="text-[12px] font-medium font-body text-foreground">{offer.buyerName}</span>
                              <span className="text-[11px] text-muted-foreground font-body">{formatCurrency(offer.offerPrice)}</span>
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* AI Leverage Strategist */}
        <div className="rounded-md border border-border/60 bg-card">
          <div className="p-5 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-accent/10 flex items-center justify-center">
                <Brain className="w-4 h-4 text-accent" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[13px] font-body font-medium text-foreground">AI Leverage Strategist</p>
                <p className="text-[11px] text-muted-foreground font-body">Analyzes offers for high-value, low-friction negotiation terms</p>
              </div>
            </div>
            <button
              onClick={runAiLeverage}
              disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-[12px] font-body font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {aiLoading ? 'Analyzing…' : aiAnalysis ? 'Re-analyze' : 'Get AI Analysis'}
            </button>
          </div>

          {aiAnalysis && (
            <div className="p-5 space-y-5">
              {/* Easiest Wins */}
              {aiAnalysis.easiest_wins?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-success" strokeWidth={1.5} />
                    <p className="text-[10px] tracking-[0.15em] uppercase text-success font-body font-medium">Easiest Wins</p>
                  </div>
                  <div className="space-y-2">
                    {aiAnalysis.easiest_wins.map((win: string, i: number) => (
                      <div key={i} className="rounded-md border border-success/20 bg-success/[0.03] p-3">
                        <p className="text-[12px] text-foreground font-body leading-relaxed">{win}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Highest Impact Terms */}
              {aiAnalysis.highest_impact_terms?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-accent" strokeWidth={1.5} />
                    <p className="text-[10px] tracking-[0.15em] uppercase text-accent font-body font-medium">Highest Impact Terms</p>
                  </div>
                  <div className="space-y-2">
                    {aiAnalysis.highest_impact_terms.map((term: string, i: number) => (
                      <div key={i} className="rounded-md border border-accent/20 bg-accent/[0.03] p-3">
                        <p className="text-[12px] text-foreground font-body leading-relaxed">{term}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Leverage Suggestions */}
              {aiAnalysis.leverage_suggestions?.length > 0 && (
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-3">AI-Generated Leverage Points</p>
                  <div className="space-y-2">
                    {aiAnalysis.leverage_suggestions.map((s: any, i: number) => {
                      const impactColor = s.seller_impact === 'high' ? 'text-accent' : s.seller_impact === 'medium' ? 'text-success' : 'text-muted-foreground';
                      const frictionColor = s.buyer_friction === 'low' ? 'text-success' : s.buyer_friction === 'medium' ? 'text-warning' : 'text-destructive';
                      return (
                        <div key={i} className="rounded-md border border-border/40 p-4 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">{s.category}</span>
                                <span className={`text-[10px] font-body font-medium ${impactColor}`}>Impact: {s.seller_impact}</span>
                                <span className={`text-[10px] font-body font-medium ${frictionColor}`}>Friction: {s.buyer_friction}</span>
                              </div>
                              <p className="text-[13px] font-body font-medium text-foreground">{s.term}</p>
                              <p className="text-[12px] text-muted-foreground font-body mt-1 leading-relaxed">{s.headline}</p>
                            </div>
                          </div>
                          <p className="text-[12px] text-muted-foreground font-body leading-relaxed">{s.reasoning}</p>
                          <div className="grid sm:grid-cols-2 gap-2">
                            <div className="rounded-sm border border-success/20 bg-success/[0.03] p-2.5">
                              <p className="text-[9px] tracking-[0.1em] uppercase text-success font-body font-medium mb-1">Seller Gets</p>
                              <p className="text-[11px] font-body text-foreground">{s.seller_gets}</p>
                            </div>
                            <div className="rounded-sm border border-border/50 bg-muted/20 p-2.5">
                              <p className="text-[9px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium mb-1">Buyer Gives</p>
                              <p className="text-[11px] font-body text-foreground">{s.buyer_gives}</p>
                            </div>
                          </div>
                          {s.applicable_buyers?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {s.applicable_buyers.map((b: string, j: number) => (
                                <span key={j} className="badge-info">{b}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              {aiAnalysis.notes && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-[11px] text-muted-foreground font-body italic leading-relaxed">
                    💡 {aiAnalysis.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}