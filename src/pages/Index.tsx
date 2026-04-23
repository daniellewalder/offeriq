import { Link } from 'react-router-dom';
import { ArrowRight, Shield, GitCompare, Brain, TrendingUp } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen bg-background selection:bg-accent/20">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-20 py-6">
        <div className="flex items-center gap-2">
          <span className="heading-display text-2xl text-foreground">CloseIQ</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors font-body tracking-wide">
            Sign In
          </Link>
          <Link
            to="/dashboard"
            className="text-[13px] font-medium bg-foreground text-background px-5 py-2 rounded-sm hover:opacity-90 transition-opacity font-body tracking-wide"
          >
            Request Demo
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-20 pt-24 lg:pt-40 pb-20 max-w-4xl mx-auto text-center animate-fade-in">
        <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground font-body mb-8">Offer Intelligence Platform</p>
        <h1 className="heading-display text-5xl lg:text-7xl text-foreground leading-[1.05] mb-8">
          Smarter Real Estate
          <br />
          Negotiations
        </h1>
        <p className="text-base lg:text-lg text-muted-foreground max-w-xl mx-auto mb-14 font-body leading-relaxed">
          Turn complex offer packages into clear, confident decisions.
          Extract terms, compare offers, score risk, and build counter-strategies.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/new-analysis"
            className="flex items-center gap-2 bg-foreground text-background px-7 py-3 rounded-sm text-[13px] font-medium hover:opacity-90 transition-opacity font-body tracking-wide"
          >
            Start Analysis <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 border border-border text-foreground px-7 py-3 rounded-sm text-[13px] font-medium hover:bg-muted/50 transition-colors font-body tracking-wide"
          >
            View Demo
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-xs mx-auto border-t border-border" />

      {/* Features */}
      <section className="px-6 lg:px-20 py-20 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-border/40">
          {[
            { icon: Brain, title: 'AI Extraction', desc: 'Extract key terms from offer packages with confidence scoring.' },
            { icon: GitCompare, title: 'Comparison', desc: 'Compare across price, risk, timing, and financial strength.' },
            { icon: Shield, title: 'Risk Scoring', desc: 'Score close probability, contingency risk, and completeness.' },
            { icon: TrendingUp, title: 'Counter Strategy', desc: 'Data-driven counteroffers that maximize seller outcomes.' },
          ].map((f) => (
            <div key={f.title} className="bg-background p-8">
              <f.icon className="w-5 h-5 text-muted-foreground mb-5" strokeWidth={1.5} />
              <h3 className="text-sm font-medium text-foreground mb-2 font-body">{f.title}</h3>
              <p className="text-[13px] text-muted-foreground font-body leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 lg:px-20 py-12 text-center">
        <p className="text-[11px] text-muted-foreground font-body tracking-wide">© 2026 CloseIQ</p>
      </footer>
    </div>
  );
}
