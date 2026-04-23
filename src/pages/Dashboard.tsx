import { Link } from 'react-router-dom';
import {
  FileText, Clock, Star, Target, ArrowRight, ChevronRight, TrendingUp,
  Shield, Scale, Upload, Sparkles, AlertTriangle, CheckCircle, DollarSign,
  BarChart3, Activity,
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { recentProperties, sampleProperty, formatCurrency } from '@/data/sampleData';

const statCards = [
  { label: 'Active Analyses', value: '4', icon: FileText, delta: '+2 this week', positive: true },
  { label: 'Offers Reviewed', value: '18', icon: BarChart3, delta: '+5 this week', positive: true },
  { label: 'Avg. Close Prob.', value: '84%', icon: Shield, delta: '+3% vs. last', positive: true },
  { label: 'Counter Strategies', value: '7', icon: Target, delta: '2 pending', positive: false },
];

const activityFeed = [
  { time: '12 min ago', icon: Sparkles, color: 'text-accent', bg: 'bg-accent/10', text: 'AI scoring completed for 1247 Stone Canyon Rd — Nakamura Trust ranked #1' },
  { time: '1 hr ago', icon: Upload, color: 'text-info', bg: 'bg-info/10', text: 'New offer package uploaded: Priya & Arun Kapoor ($8.8M, conventional)' },
  { time: '2 hrs ago', icon: Target, color: 'text-success', bg: 'bg-success/10', text: 'Counter strategy generated: Best Balance targets Kapoor at $8.95M' },
  { time: '3 hrs ago', icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', text: 'Risk alert: Ashford offer has 3 contingencies and 45-day close — high timing risk' },
  { time: '5 hrs ago', icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', text: 'Document verification complete: Chen package — 100% verified, all docs present' },
  { time: '1 day ago', icon: DollarSign, color: 'text-accent', bg: 'bg-accent/10', text: 'Counter sent to 815 N Rodeo Dr — Maximize Price strategy at $4.2M' },
];

const quickActions = [
  { label: 'New Analysis', desc: 'Upload offer packages', icon: Upload, to: '/new-analysis', accent: 'border-accent/30 hover:border-accent/50' },
  { label: 'Compare Offers', desc: 'Side-by-side breakdown', icon: Scale, to: '/comparison', accent: 'border-info/30 hover:border-info/50' },
  { label: 'Risk Scoring', desc: 'Score & factor analysis', icon: Shield, to: '/risk-scoring', accent: 'border-success/30 hover:border-success/50' },
  { label: 'Counter Builder', desc: 'Generate strategies', icon: Target, to: '/counter-strategy', accent: 'border-warning/30 hover:border-warning/50' },
];

export default function Dashboard() {
  const topOffer = sampleProperty.offers[0]; // Nakamura — highest
  const safeOffer = sampleProperty.offers[1]; // Chen — safest

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Overview</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Welcome back</h1>
          <p className="text-[13px] text-muted-foreground font-body mt-2">Here's what's happening across your active deals.</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/40 rounded-md overflow-hidden">
          {statCards.map((s) => (
            <div key={s.label} className="bg-card p-5 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <s.icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                <span className={`text-[10px] font-body font-medium ${s.positive ? 'text-success' : 'text-muted-foreground'}`}>
                  {s.delta}
                </span>
              </div>
              <p className="text-3xl font-light text-foreground font-display mb-1">{s.value}</p>
              <p className="text-[11px] text-muted-foreground font-body tracking-wide uppercase">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className={`rounded-md border p-4 transition-all duration-200 bg-card group ${a.accent}`}
            >
              <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center mb-3 group-hover:bg-accent/10 transition-colors">
                <a.icon className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-medium font-body text-foreground">{a.label}</p>
              <p className="text-[11px] text-muted-foreground font-body mt-0.5">{a.desc}</p>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Active Deal Spotlight */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">Active Deal Spotlight</p>
              <Link to="/comparison" className="text-[11px] text-muted-foreground hover:text-foreground font-body flex items-center gap-1 transition-colors">
                View Comparison <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Top Offer Card */}
            <div className="card-elevated p-5 border-accent/30">
              <div className="flex items-center gap-2 mb-3">
                <span className="badge-gold">Top Recommendation</span>
                <span className="text-[10px] text-muted-foreground font-body">{sampleProperty.address}</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="heading-display text-xl text-foreground">{topOffer.buyerName}</p>
                  <p className="text-[12px] text-muted-foreground font-body mt-0.5">
                    {topOffer.agentName} · {topOffer.agentBrokerage}
                  </p>
                </div>
                <div className="text-right">
                  <p className="heading-display text-2xl text-foreground">{formatCurrency(topOffer.offerPrice)}</p>
                  <p className="text-[11px] text-success font-body font-medium">
                    +{formatCurrency(topOffer.offerPrice - sampleProperty.listingPrice)} vs. list
                  </p>
                </div>
              </div>

              {/* Mini scores row */}
              <div className="grid grid-cols-4 gap-3 pt-3 border-t border-border/40">
                {[
                  { label: 'Strength', value: topOffer.scores.offerStrength, suffix: '/100' },
                  { label: 'Close Prob.', value: topOffer.scores.closeProbability, suffix: '%' },
                  { label: 'Financial', value: topOffer.scores.financialConfidence, suffix: '/100' },
                  { label: 'Cont. Risk', value: topOffer.scores.contingencyRisk, suffix: '%', isRisk: true },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className={`font-display text-lg ${
                      s.isRisk
                        ? (s.value <= 20 ? 'text-success' : s.value <= 40 ? 'text-warning' : 'text-destructive')
                        : (s.value >= 85 ? 'text-success' : s.value >= 70 ? 'text-warning' : 'text-destructive')
                    }`}>
                      {s.value}{s.suffix}
                    </p>
                    <p className="text-[9px] text-muted-foreground font-body tracking-wide uppercase mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Offer summary strip */}
            <div className="grid grid-cols-5 gap-px bg-border/40 rounded-md overflow-hidden">
              {sampleProperty.offers.map((o, i) => (
                <Link
                  key={o.id}
                  to="/risk-scoring"
                  className={`bg-card p-3 text-center hover:bg-muted/30 transition-colors ${i === 0 ? 'ring-1 ring-inset ring-accent/20' : ''}`}
                >
                  <p className="text-[11px] font-body font-medium text-foreground truncate">{o.buyerName.split(' ')[o.buyerName.split(' ').length > 2 ? 1 : 0]}</p>
                  <p className="font-display text-lg text-foreground mt-0.5">{o.scores.offerStrength}</p>
                  <p className="text-[9px] text-muted-foreground font-body">strength</p>
                </Link>
              ))}
            </div>

            {/* Recent Properties */}
            <div className="card-elevated">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                <h2 className="text-[13px] font-medium font-body text-foreground">Recent Properties</h2>
                <Link to="/new-analysis" className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors">
                  New <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-border/40">
                {recentProperties.map((p) => (
                  <Link
                    key={p.id}
                    to="/offer-intake"
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground font-body truncate">{p.address}</p>
                      <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                        {p.offers} offers · {p.lastUpdated}
                      </p>
                    </div>
                    <div className="hidden sm:block mx-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        p.status === 'Reviewing Offers' ? 'badge-info' :
                        p.status === 'Counter Sent' ? 'badge-warning' :
                        p.status === 'Pending Review' ? 'badge-gold' :
                        'badge-success'
                      }`}>{p.status}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">Activity</p>
            </div>

            <div className="space-y-0">
              {activityFeed.map((a, i) => (
                <div key={i} className="flex gap-3 py-3 border-b border-border/30 last:border-none">
                  <div className={`w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0 mt-0.5 ${a.bg}`}>
                    <a.icon className={`w-3.5 h-3.5 ${a.color}`} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-body text-foreground leading-relaxed">{a.text}</p>
                    <p className="text-[10px] text-muted-foreground font-body mt-1">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Key Insight */}
            <div className="mt-4 rounded-md border border-accent/20 bg-accent/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-accent" strokeWidth={1.5} />
                <span className="text-[10px] tracking-[0.1em] uppercase text-accent font-body font-medium">Key Insight</span>
              </div>
              <p className="text-[12px] font-body text-foreground leading-relaxed">
                The Nakamura Trust offer at {formatCurrency(topOffer.offerPrice)} all-cash combines the highest price with a {topOffer.scores.closeProbability}% close probability — a rare alignment. Consider countering at $9.05M with tightened inspection to lock this down.
              </p>
              <Link to="/counter-strategy" className="flex items-center gap-1 mt-3 text-[11px] text-accent font-body font-medium hover:underline">
                View Counter Strategy <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}