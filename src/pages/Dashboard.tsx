import { Link } from 'react-router-dom';
import { FileText, Clock, Star, Target, ArrowRight, ChevronRight } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { recentProperties } from '@/data/sampleData';

const statCards = [
  { label: 'Active Analyses', value: '4', icon: FileText, color: 'bg-info/10 text-info' },
  { label: 'Pending Reviews', value: '2', icon: Clock, color: 'bg-warning/10 text-warning' },
  { label: 'Recommended Offers', value: '3', icon: Star, color: 'bg-success/10 text-success' },
  { label: 'Counter Strategies', value: '5', icon: Target, color: 'bg-gold-light text-gold' },
];

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        <div>
          <h1 className="heading-display text-2xl lg:text-3xl font-semibold mb-1">Welcome back</h1>
          <p className="text-muted-foreground font-body text-sm">Here's your deal intelligence overview.</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <div key={s.label} className="card-elevated p-5">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-semibold text-foreground font-body">{s.value}</p>
              <p className="text-xs text-muted-foreground font-body mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Recent Properties */}
        <div className="card-elevated">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="heading-display text-lg font-semibold">Recent Properties</h2>
            <Link to="/new-analysis" className="text-sm text-gold hover:underline flex items-center gap-1 font-body">
              New Analysis <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentProperties.map((p) => (
              <Link
                key={p.id}
                to="/offer-intake"
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground font-body truncate">{p.address}</p>
                  <p className="text-xs text-muted-foreground font-body mt-0.5">
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