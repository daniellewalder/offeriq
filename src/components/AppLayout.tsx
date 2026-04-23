import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  GitCompare,
  ShieldCheck,
  SlidersHorizontal,
  Lightbulb,
  Target,
  BarChart3,
  ClipboardCheck,
  FileBarChart,
  Menu,
  X,
  LogOut,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/new-analysis', label: 'New Analysis', icon: FilePlus },
  { to: '/offer-intake', label: 'Offer Intake', icon: FileText },
  { to: '/comparison', label: 'Comparison', icon: GitCompare },
  { to: '/risk-scoring', label: 'Risk Scoring', icon: ShieldCheck },
  { to: '/priorities', label: 'Seller Priorities', icon: SlidersHorizontal },
  { to: '/leverage', label: 'Negotiation', icon: Lightbulb },
  { to: '/counter-strategy', label: 'Counter Strategy', icon: Target },
  { to: '/delta-view', label: 'Delta View', icon: BarChart3 },
  { to: '/buyer-readiness', label: 'Buyer Readiness', icon: ClipboardCheck },
  { to: '/report', label: 'Report', icon: FileBarChart },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-border">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm font-body">CQ</span>
            </div>
            <span className="heading-display text-xl font-semibold text-foreground">CloseIQ</span>
          </Link>
          <p className="text-xs text-muted-foreground mt-1 font-body">Offer Intelligence</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors font-body ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-body"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center px-4 lg:px-8 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <button className="lg:hidden mr-3 p-1.5 rounded-lg hover:bg-muted" onClick={() => setSidebarOpen(true)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-body">1247 Stone Canyon Rd</span>
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">JW</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}