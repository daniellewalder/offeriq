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
        className={`fixed lg:static inset-y-0 left-0 z-50 w-60 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-6 py-7 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="heading-display text-xl text-sidebar-primary">OfferIQ</span>
          </Link>
          <p className="text-[10px] tracking-[0.15em] uppercase text-sidebar-foreground/50 mt-1.5 font-body">Offer Intelligence</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-sm text-[13px] transition-colors font-body ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-sm text-[13px] text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors font-body"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
            Sign Out
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-border flex items-center px-4 lg:px-10 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
          <button className="lg:hidden mr-3 p-1.5 rounded-lg hover:bg-muted" onClick={() => setSidebarOpen(true)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-muted-foreground font-body tracking-wide">1247 Stone Canyon Rd</span>
            <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center">
              <span className="text-[10px] font-medium text-background">JW</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-5 lg:p-10 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}