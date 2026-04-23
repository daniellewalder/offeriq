import { Link } from 'react-router-dom';
import { FileText, Clock, Star, Target, ArrowRight, ChevronRight } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { recentProperties } from '@/data/sampleData';

const statCards = [
  { label: 'Active Analyses', value: '4', icon: FileText },
  { label: 'Pending Reviews', value: '2', icon: Clock },
  { label: 'Recommended', value: '3', icon: Star },
  { label: 'Strategies', value: '5', icon: Target },
];

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-10 animate-fade-in">
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Overview</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Welcome back</h1>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/40">
          {statCards.map((s) => (
            <div key={s.label} className="bg-card p-6">
              <s.icon className="w-4 h-4 text-muted-foreground mb-4" strokeWidth={1.5} />
              <p className="text-3xl font-light text-foreground font-display mb-1">{s.value}</p>
              <p className="text-[11px] text-muted-foreground font-body tracking-wide uppercase">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Recent Properties */}
        <div className="card-elevated">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
            <h2 className="heading-display text-xl text-foreground">Recent Properties</h2>
            <Link to="/new-analysis" className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-body tracking-wide transition-colors">
              New Analysis <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentProperties.map((p) => (
              <Link
                key={p.id}
                to="/offer-intake"
                className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground font-body truncate">{p.address}</p>
                  <p className="text-[11px] text-muted-foreground font-body mt-1">
                    {p.offers} offers · {p.lastUpdated}
                  </p>
                </div>
                <div className="hidden sm:block text-right mx-4">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    p.status === 'Reviewing Offers' ? 'badge-info' :
                    p.status === 'Counter Sent' ? 'badge-warning' :
                    p.status === 'Pending Review' ? 'badge-gold' :
                    'badge-success'
                  }`}>{p.status}</span>
                </div>
                <div className="hidden md:block text-right mr-2">
                  <p className="text-xs text-muted-foreground font-body">{p.topRec}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}