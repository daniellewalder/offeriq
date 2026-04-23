import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { sampleProperty, formatCurrency } from '@/data/sampleData';
import { TrendingUp, Shield, Scale, RefreshCw, FileText, ArrowRight, Check, AlertTriangle, Brain, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/* ── Types ── */
interface Term {
  label: string;
  value: string;
  delta?: string;           // change vs. original offer
  sentiment?: 'positive' | 'neutral' | 'caution';
}

interface Strategy {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof TrendingUp;
  accent: string;             // border / highlight color
  iconBg: string;
  targetOffer: string;        // offer id
  counterPrice: number;
  acceptanceLikelihood: number; // 0-100
  netProceeds: string;
  terms: Term[];
  rationale: string;
  risk: string;
  recommended?: boolean;
}

/* ── Data ── */
const strategies: Strategy[] = [
  {
    id: 'maximize-price',
    title: 'Maximize Price',
    subtitle: 'Push for top dollar from the strongest cash buyer',
    icon: TrendingUp,
    accent: 'border-accent/50',
    iconBg: 'bg-accent/10 text-accent',
    targetOffer: 'offer-a',
    counterPrice: 9050000,
    acceptanceLikelihood: 72,
    netProceeds: '$8,920,000',
    terms: [
      { label: 'Counter Price', value: '$9,050,000', delta: '−$50K from their offer', sentiment: 'positive' },
      { label: 'Close Timeline', value: '21 days', delta: 'Match their ask', sentiment: 'positive' },
      { label: 'Inspection', value: '5 days only', delta: 'Down from 7', sentiment: 'positive' },
      { label: 'Appraisal', value: 'Waived (cash)', sentiment: 'positive' },
      { label: 'Earnest Money', value: '$300,000', delta: '+$25K from their offer', sentiment: 'positive' },
      { label: 'Leaseback', value: '7-day rent-free', delta: 'Concession to buyer', sentiment: 'neutral' },
      { label: 'Repairs', value: 'Sold as-is', sentiment: 'positive' },
      { label: 'Doc Requests', value: 'Updated POF within 48 hours', sentiment: 'neutral' },
    ],
    rationale: "The Nakamura Trust is relocating from Tokyo and came in $350K over asking in all cash. That's not a buyer who's testing the water — they need a house. Counter at $9.05M (only a $50K concession) and tighten the inspection to 5 days. Give them the 21-day close they want and a 7-day leaseback — both cost you nothing but make the counter feel collaborative rather than adversarial. At this price point, the $50K haircut is a rounding error for them, and the tighter inspection tells them you're serious about moving fast.",
    risk: "If Nakamura pushes back on the 5-day inspection, you have room to go to 7 without losing anything material. The real risk is overplaying — don't add terms that give a motivated cash buyer a reason to walk.",
  },
  {
    id: 'maximize-certainty',
    title: 'Maximize Certainty',
    subtitle: 'Lock in the most reliable path to close',
    icon: Shield,
    accent: 'border-success/40',
    iconBg: 'bg-success/10 text-success',
    targetOffer: 'offer-b',
    counterPrice: 8850000,
    acceptanceLikelihood: 91,
    netProceeds: '$8,710,000',
    terms: [
      { label: 'Counter Price', value: '$8,850,000', delta: '−$50K from their offer', sentiment: 'neutral' },
      { label: 'Close Timeline', value: '30 days', delta: 'Match their ask', sentiment: 'positive' },
      { label: 'Inspection', value: '10 days (standard)', delta: 'No change', sentiment: 'neutral' },
      { label: 'Appraisal', value: 'Gap coverage up to $200K required', delta: 'New requirement', sentiment: 'caution' },
      { label: 'Earnest Money', value: '$250,000', delta: '+$50K from their offer', sentiment: 'positive' },
      { label: 'Leaseback', value: '14-day rent-free', delta: 'Extend their 7-day offer', sentiment: 'neutral' },
      { label: 'Repairs', value: 'As-is with $15K credit', sentiment: 'neutral' },
      { label: 'Doc Requests', value: 'None — package complete', sentiment: 'positive' },
    ],
    rationale: "The Chens submitted the most complete package in this group — every document verified, First Republic pre-approval, full income documentation. You're not going to get $9M from this buyer, but what you're getting is a deal that actually closes. The key move is adding appraisal gap coverage: it's the one risk in an otherwise bulletproof offer. At $8.85M with gap protection, increased earnest money, and a 14-day leaseback, you're building a deal with almost no failure points. The $200K you leave on the table versus the top-price path is insurance against the deal that falls apart at day 40.",
    risk: 'The appraisal gap requirement is the only ask that might create friction. First Republic borrowers can typically handle it, but if the Chens push back, consider reducing the coverage to $100K — still meaningful protection.',
  },
  {
    id: 'best-balance',
    title: 'Best Balance',
    subtitle: 'The most likely path to a deal both sides feel good about',
    icon: Scale,
    accent: 'border-info/40',
    iconBg: 'bg-info/10 text-info',
    targetOffer: 'offer-e',
    counterPrice: 8950000,
    acceptanceLikelihood: 84,
    netProceeds: '$8,820,000',
    terms: [
      { label: 'Counter Price', value: '$8,950,000', delta: '+$150K from their offer', sentiment: 'positive' },
      { label: 'Close Timeline', value: '28 days', delta: 'Match their ask', sentiment: 'positive' },
      { label: 'Inspection', value: '7 days', delta: 'Down from 10', sentiment: 'positive' },
      { label: 'Appraisal', value: 'Maintain $200K gap coverage', delta: 'Already offered', sentiment: 'positive' },
      { label: 'Earnest Money', value: '$275,000', delta: '+$95K from their offer', sentiment: 'positive' },
      { label: 'Leaseback', value: '10-day rent-free', delta: 'Split their 14-day offer', sentiment: 'neutral' },
      { label: 'Repairs', value: 'As-is, no credits', sentiment: 'positive' },
      { label: 'Doc Requests', value: 'Written gap coverage confirmation', sentiment: 'neutral' },
    ],
    rationale: "The Kapoors are the kind of buyer you build a deal around. They already volunteered appraisal gap coverage — unprompted — which tells you their agent understands how luxury deals collapse and prepared accordingly. Counter at $8.95M (a $150K bump they can absorb with 25% down through Chase Private Client), tighten inspection to 7 days, and bump the deposit to $275K. You're asking for more, but every ask is reasonable and they've already signaled flexibility. The 10-day leaseback splits the difference on their 14-day offer — a small concession that demonstrates good faith. This is the path with the fewest hard conversations and the highest probability of both sides signing.",
    risk: "The $150K price increase is the main negotiation point. If they counter back at $8.9M, you're still $150K above asking with gap coverage and a clean structure. That's a strong deal by any measure.",
    recommended: true,
  },
];

/* ── Helpers ── */
const sentimentIcon = (s?: string) => {
  if (s === 'positive') return <Check className="w-3 h-3 text-success" strokeWidth={2} />;
  if (s === 'caution') return <AlertTriangle className="w-3 h-3 text-warning" strokeWidth={1.5} />;
  return null;
};

const likelihoodColor = (v: number) => {
  if (v >= 85) return 'text-success';
  if (v >= 70) return 'text-info';
  return 'text-warning';
};
const likelihoodBar = (v: number) => {
  if (v >= 85) return 'bg-success';
  if (v >= 70) return 'bg-info';
  return 'bg-warning';
};

/* ── Component ── */
export default function CounterStrategy() {
  const [selected, setSelected] = useState('best-balance');
  const active = strategies.find(s => s.id === selected)!;
  const targetOffer = sampleProperty.offers.find(o => o.id === active.targetOffer)!;
  const [aiStrategies, setAiStrategies] = useState<any>(null);
  const [aiSelected, setAiSelected] = useState<string>('best_balance');
  const [aiLoading, setAiLoading] = useState(false);
  const { toast } = useToast();

  const runAiCounter = async () => {
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
        close_timeline: o.closeTimeline,
        leaseback: o.leasebackRequest,
        concessions: o.concessions,
        proof_of_funds: o.proofOfFunds,
        pre_approval: o.preApproval,
        completeness: o.completeness,
        close_probability: o.scores.closeProbability,
        financial_confidence: o.scores.financialConfidence,
        contingency_risk: o.scores.contingencyRisk,
        special_notes: o.specialNotes,
      }));

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-counter`, {
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
        toast({ title: 'AI Generation Error', description: data?.error || 'Request failed', variant: 'destructive' });
      } else if (data?.analysis?.strategies) {
        setAiStrategies(data.analysis.strategies);
        setAiSelected('best_balance');
      }
    } catch (e: any) {
      toast({ title: 'AI Generation Failed', description: e.message || 'Something went wrong', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const aiActive = aiStrategies?.find((s: any) => s.strategy_type === aiSelected);
  const aiStrategyMeta: Record<string, { icon: typeof TrendingUp; accent: string; iconBg: string }> = {
    maximize_price: { icon: TrendingUp, accent: 'border-accent/50', iconBg: 'bg-accent/10 text-accent' },
    maximize_certainty: { icon: Shield, accent: 'border-success/40', iconBg: 'bg-success/10 text-success' },
    best_balance: { icon: Scale, accent: 'border-info/40', iconBg: 'bg-info/10 text-info' },
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Strategy</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Counter Strategy Builder</h1>
          <p className="text-[13px] text-muted-foreground font-body mt-2 max-w-2xl">
            Three distinct paths — each targeting a different offer with a different thesis. Pick the one that matches what the seller values most.
          </p>
        </div>

        {/* ── Strategy Selector ── */}
        <div className="grid sm:grid-cols-3 gap-3">
          {strategies.map((s) => {
            const isActive = selected === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`text-left rounded-md border p-5 transition-all duration-300 ${
                  isActive ? `${s.accent} bg-card shadow-sm` : 'border-border/40 bg-card hover:border-border'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${s.iconBg}`}>
                    <s.icon className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-medium font-body text-foreground">{s.title}</h3>
                      {s.recommended && <span className="badge-gold">Recommended</span>}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground font-body leading-relaxed mb-3">{s.subtitle}</p>
                <div className="flex items-baseline gap-3">
                  <span className="heading-display text-2xl text-foreground">{formatCurrency(s.counterPrice)}</span>
                  <span className={`text-[11px] font-body font-medium ${likelihoodColor(s.acceptanceLikelihood)}`}>{s.acceptanceLikelihood}% likely</span>
                </div>
                {/* Likelihood bar */}
                <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
                  <div className={`h-full rounded-full transition-all duration-500 ${isActive ? likelihoodBar(s.acceptanceLikelihood) : 'bg-muted-foreground/20'}`} style={{ width: `${s.acceptanceLikelihood}%` }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Active Strategy Detail ── */}
        <div className={`rounded-md border ${active.accent} bg-card`}>
          {/* Target offer context */}
          <div className="px-6 py-5 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-1">Countering</p>
              <p className="text-[15px] font-medium font-body text-foreground">{targetOffer.buyerName}</p>
              <p className="text-[12px] text-muted-foreground font-body mt-0.5">
                Original offer: {formatCurrency(targetOffer.offerPrice)} · {targetOffer.financingType} · {targetOffer.closeTimeline}
              </p>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body">Acceptance</p>
                <p className={`text-xl font-display ${likelihoodColor(active.acceptanceLikelihood)}`}>{active.acceptanceLikelihood}%</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body">Est. Net</p>
                <p className="text-xl font-display text-foreground">{active.netProceeds}</p>
              </div>
            </div>
          </div>

          {/* Terms grid */}
          <div className="px-6 py-5 border-b border-border/40">
            <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-4">Counter Terms</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
              {active.terms.map((t) => (
                <div key={t.label}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {sentimentIcon(t.sentiment)}
                    <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium">{t.label}</p>
                  </div>
                  <p className="text-[14px] font-body text-foreground font-medium">{t.value}</p>
                  {t.delta && <p className="text-[11px] text-muted-foreground font-body mt-0.5">{t.delta}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Rationale */}
          <div className="px-6 py-5 border-b border-border/40">
            <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-3">Why This Works</p>
            <p className="text-[13px] text-muted-foreground font-body leading-[1.7]">{active.rationale}</p>
          </div>

          {/* Risk */}
          <div className="px-6 py-5 border-b border-border/40">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" strokeWidth={1.5} />
              <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">What Could Go Wrong</p>
            </div>
            <p className="text-[13px] text-muted-foreground font-body leading-[1.7]">{active.risk}</p>
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

        {/* ── AI Counter Strategy Generator ── */}
        <div className="rounded-md border border-border/60 bg-card">
          <div className="p-5 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-accent/10 flex items-center justify-center">
                <Brain className="w-4 h-4 text-accent" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[13px] font-body font-medium text-foreground">AI Counter Strategy Generator</p>
                <p className="text-[11px] text-muted-foreground font-body">Generates 3 tailored counteroffer strategies from offer data</p>
              </div>
            </div>
            <button
              onClick={runAiCounter}
              disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-[12px] font-body font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiLoading ? 'Generating…' : aiStrategies ? 'Regenerate' : 'Generate AI Strategies'}
            </button>
          </div>

          {aiStrategies && (
            <div className="p-5 space-y-5">
              {/* AI Strategy Selector */}
              <div className="grid sm:grid-cols-3 gap-3">
                {aiStrategies.map((s: any) => {
                  const meta = aiStrategyMeta[s.strategy_type] || aiStrategyMeta.best_balance;
                  const Icon = meta.icon;
                  const isActive = aiSelected === s.strategy_type;
                  return (
                    <button
                      key={s.strategy_type}
                      onClick={() => setAiSelected(s.strategy_type)}
                      className={`text-left rounded-md border p-4 transition-all duration-300 ${isActive ? `${meta.accent} bg-card shadow-sm` : 'border-border/40 bg-card hover:border-border'}`}
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className={`w-7 h-7 rounded-sm flex items-center justify-center ${meta.iconBg}`}>
                          <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-[12px] font-medium font-body text-foreground">{s.title}</h3>
                          {s.strategy_type === 'best_balance' && <span className="badge-gold text-[9px]">AI Pick</span>}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-body leading-relaxed mb-2">{s.subtitle}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="heading-display text-xl text-foreground">{typeof s.counter_price === 'number' ? formatCurrency(s.counter_price) : s.counter_price}</span>
                        <span className={`text-[10px] font-body font-medium ${likelihoodColor(s.acceptance_likelihood)}`}>{s.acceptance_likelihood}%</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                        <div className={`h-full rounded-full transition-all duration-500 ${isActive ? likelihoodBar(s.acceptance_likelihood) : 'bg-muted-foreground/20'}`} style={{ width: `${s.acceptance_likelihood}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* AI Active Strategy Detail */}
              {aiActive && (() => {
                const meta = aiStrategyMeta[aiActive.strategy_type] || aiStrategyMeta.best_balance;
                return (
                  <div className={`rounded-md border ${meta.accent} bg-card`}>
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-1">AI Counter — Targeting</p>
                        <p className="text-[15px] font-medium font-body text-foreground">{aiActive.target_buyer}</p>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body">Acceptance</p>
                          <p className={`text-xl font-display ${likelihoodColor(aiActive.acceptance_likelihood)}`}>{aiActive.acceptance_likelihood}%</p>
                        </div>
                        {aiActive.estimated_net_proceeds && (
                          <div className="text-right">
                            <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body">Est. Net</p>
                            <p className="text-xl font-display text-foreground">{aiActive.estimated_net_proceeds}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Key Terms */}
                    <div className="px-5 py-4 border-b border-border/40">
                      <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-3">Counter Terms</p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                        <div>
                          <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium mb-0.5">Counter Price</p>
                          <p className="text-[14px] font-body text-foreground font-medium">{typeof aiActive.counter_price === 'number' ? formatCurrency(aiActive.counter_price) : aiActive.counter_price}</p>
                        </div>
                        <div>
                          <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium mb-0.5">Close Timeline</p>
                          <p className="text-[13px] font-body text-foreground">{aiActive.closing_timeline_strategy}</p>
                        </div>
                        <div>
                          <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium mb-0.5">Earnest Money</p>
                          <p className="text-[13px] font-body text-foreground">{aiActive.deposit_strategy}</p>
                        </div>
                        <div>
                          <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground font-body font-medium mb-0.5">Leaseback</p>
                          <p className="text-[13px] font-body text-foreground">{aiActive.leaseback_terms}</p>
                        </div>
                      </div>
                    </div>

                    {/* Contingency Changes */}
                    {aiActive.contingency_changes?.length > 0 && (
                      <div className="px-5 py-4 border-b border-border/40">
                        <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-3">Contingency Changes</p>
                        <div className="space-y-2">
                          {aiActive.contingency_changes.map((c: any, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <Check className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" strokeWidth={2} />
                              <div>
                                <p className="text-[12px] font-body font-medium text-foreground">{c.term}: {c.change}</p>
                                <p className="text-[11px] text-muted-foreground font-body">{c.rationale}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Document Requests */}
                    {aiActive.supporting_document_requests?.length > 0 && (
                      <div className="px-5 py-4 border-b border-border/40">
                        <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-2">Document Requests</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiActive.supporting_document_requests.map((d: string, i: number) => (
                            <span key={i} className="badge-info">{d}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rationale */}
                    <div className="px-5 py-4 border-b border-border/40">
                      <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-2">Why This Works</p>
                      <p className="text-[13px] text-muted-foreground font-body leading-[1.7]">{aiActive.rationale}</p>
                    </div>

                    {/* Risk + Acceptance */}
                    <div className="px-5 py-4 grid sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-warning" strokeWidth={1.5} />
                          <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">Risk</p>
                        </div>
                        <p className="text-[12px] text-muted-foreground font-body leading-relaxed">{aiActive.risk}</p>
                      </div>
                      {aiActive.acceptance_likelihood_description && (
                        <div>
                          <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-2">Acceptance Assessment</p>
                          <p className="text-[12px] text-muted-foreground font-body leading-relaxed">{aiActive.acceptance_likelihood_description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}