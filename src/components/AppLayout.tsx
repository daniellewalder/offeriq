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

const navSections: { label: string; items: { to: string; label: string; icon: any }[] }[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/new-analysis', label: 'New Analysis', icon: FilePlus },
      { to: '/offer-intake', label: 'Offer Intake', icon: FileText },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { to: '/comparison', label: 'Comparison', icon: GitCompare },
      { to: '/risk-scoring', label: 'Risk Scoring', icon: ShieldCheck },
      { to: '/buyer-readiness', label: 'Buyer Readiness', icon: ClipboardCheck },
      { to: '/delta-view', label: 'Delta View', icon: BarChart3 },
    ],
  },
  {
    label: 'Strategy',
    items: [
      { to: '/priorities', label: 'Seller Priorities', icon: SlidersHorizontal },
      { to: '/leverage', label: 'Negotiation', icon: Lightbulb },
      { to: '/counter-strategy', label: 'Counter Strategy', icon: Target },
      { to: '/report', label: 'Recommendation', icon: FileBarChart },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-6 pt-7 pb-6 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-baseline gap-2 group">
            <span className="heading-display text-[22px] text-sidebar-primary tracking-tight">OfferIQ</span>
            <span className="w-1 h-1 rounded-full bg-accent group-hover:scale-125 transition-transform" />
          </Link>
          <p className="text-[9.5px] tracking-[0.22em] uppercase text-sidebar-foreground/45 mt-2 font-body font-medium">
            Offer Intelligence
          </p>
        </div>

        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          {navSections.map((section, si) => (
            <div key={section.label} className={si > 0 ? 'mt-6' : ''}>
              <p className="px-3 mb-2 text-[9.5px] tracking-[0.22em] uppercase text-sidebar-foreground/40 font-body font-medium">
                {section.label}
              </p>
              <div className="space-y-px">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={`relative flex items-center gap-3 px-3 py-[7px] rounded-md text-[12.5px] transition-all duration-200 font-body group ${
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/40'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] bg-accent rounded-r" />
                      )}
                      <item.icon
                        className={`w-[15px] h-[15px] flex-shrink-0 ${isActive ? 'text-accent' : 'text-sidebar-foreground/70 group-hover:text-sidebar-foreground'}`}
                        strokeWidth={1.5}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-md">
            <div className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center shadow-sm">
              <span className="text-[11px] font-medium text-accent-foreground tracking-wide">JW</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-body font-medium text-sidebar-accent-foreground truncate">Jessica Wong</p>
              <p className="text-[10px] font-body text-sidebar-foreground/55 truncate">Listing Agent · Compass</p>
            </div>
            <Link
              to="/"
              className="text-sidebar-foreground/60 hover:text-sidebar-accent-foreground transition-colors p-1.5 rounded hover:bg-sidebar-accent/40"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border/70 flex items-center px-4 lg:px-12 bg-background/85 backdrop-blur-md sticky top-0 z-30">
          <button
            className="lg:hidden mr-3 p-1.5 rounded-md hover:bg-muted text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="hidden lg:flex items-center gap-2.5 text-[11.5px] font-body">
            <span className="text-muted-foreground tracking-[0.12em] uppercase text-[10px]">Active Listing</span>
            <span className="w-1 h-1 rounded-full bg-border-strong" />
            <span className="text-foreground font-medium">1247 Stone Canyon Rd</span>
            <span className="text-muted-foreground">· Bel Air, CA</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-5">
            <div className="hidden md:flex items-center gap-2 text-[11px] font-body">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-muted-foreground">Live · 5 offers</span>
            </div>
            <div className="h-5 w-px bg-border hidden md:block" />
            <span className="text-[11px] text-muted-foreground font-body tracking-wide">v1.2 · Beta</span>
          </div>
        </header>
        <main className="flex-1 px-5 py-8 lg:px-14 lg:py-12 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}