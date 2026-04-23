import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Target, ArrowRight, Shield, Scale, Upload, Share2,
  Loader2, BarChart3, Eye,
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import DealPortalCard from '@/components/DealPortalCard';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchDealCardsForUser,
  type DealCard,
} from '@/lib/dealsDashboardService';

const quickActions = [
  { label: 'New Analysis', desc: 'Upload offer packages', icon: Upload, to: '/new-analysis', accent: 'border-accent/30 hover:border-accent/50' },
  { label: 'Compare Offers', desc: 'Side-by-side breakdown', icon: Scale, to: '/comparison', accent: 'border-info/30 hover:border-info/50' },
  { label: 'Risk Scoring', desc: 'Score & factor analysis', icon: Shield, to: '/risk-scoring', accent: 'border-success/30 hover:border-success/50' },
  { label: 'Counter Builder', desc: 'Generate strategies', icon: Target, to: '/counter-strategy', accent: 'border-warning/30 hover:border-warning/50' },
];

export default function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [deals, setDeals] = useState<DealCard[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    try {
      const list = await fetchDealCardsForUser(user.id, 12);
      setDeals(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Real-data stats only
  const totalDeals = deals.length;
  const totalOffers = deals.reduce((sum, d) => sum + d.offerCount, 0);
  const sharedCount = deals.filter((d) => d.portal && !d.portal.revokedAt).length;
  const viewedCount = deals.filter((d) => d.portal?.lastAccessedAt && !d.portal.revokedAt).length;

  const stats = [
    { label: 'Active Deals', value: totalDeals, icon: FileText },
    { label: 'Offers Reviewed', value: totalOffers, icon: BarChart3 },
    { label: 'Portals Shared', value: sharedCount, icon: Share2 },
    { label: 'Portals Viewed', value: viewedCount, icon: Eye },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Overview</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Welcome back</h1>
          <p className="text-[13px] text-muted-foreground font-body mt-2">
            {loading
              ? 'Loading your real deals…'
              : totalDeals === 0
              ? 'No deals yet — start a new analysis to begin reviewing offers.'
              : `Here's what's happening across your ${totalDeals} active deal${totalDeals === 1 ? '' : 's'}.`}
          </p>
        </div>

        {/* Stat Cards — real numbers only */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/40 rounded-md overflow-hidden">
          {stats.map((s) => (
            <div key={s.label} className="bg-card p-5 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <s.icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-3xl font-light text-foreground font-display mb-1 tabular-nums">
                {loading ? '—' : s.value}
              </p>
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

        {/* Real Deals + Seller Portal Status */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[13px] font-medium font-body text-foreground">Your deals</h2>
              <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                {loading
                  ? 'Loading…'
                  : `${totalDeals} active · ${sharedCount} shared with sellers · ${viewedCount} opened`}
              </p>
            </div>
            <Link to="/new-analysis" className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors">
              New <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="card-elevated p-8 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-[12px] font-body">Loading your deals…</span>
            </div>
          ) : !userId ? (
            <div className="card-elevated p-10 text-center max-w-2xl mx-auto">
              <p className="text-[14px] font-body text-foreground mb-2">Sign in to see your deals</p>
              <p className="text-[12px] text-muted-foreground font-body">
                Live deal data and seller portal status appear here once you're authenticated.
              </p>
            </div>
          ) : deals.length === 0 ? (
            <div className="card-elevated p-10 text-center max-w-2xl mx-auto">
              <Share2 className="w-6 h-6 text-muted-foreground mx-auto mb-4" strokeWidth={1.5} />
              <p className="text-[14px] font-body text-foreground mb-2">No deals yet</p>
              <p className="text-[12px] text-muted-foreground font-body mb-5">
                Start a new analysis to upload offer packages, score them, build counter strategies, and share a private portal with your seller.
              </p>
              <Link
                to="/new-analysis"
                className="inline-flex items-center gap-1.5 text-[12px] font-body font-medium px-4 py-2 rounded-sm bg-accent/10 text-accent border border-accent/30 hover:bg-accent/15 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" strokeWidth={1.5} /> Start a new analysis
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {deals.map((d) => (
                <DealPortalCard
                  key={d.analysisId}
                  deal={d}
                  userId={userId}
                  onChanged={refresh}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
