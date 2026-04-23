import { Link } from 'react-router-dom';
import { ArrowRight, Shield, GitCompare, Brain, TrendingUp } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-16 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">CQ</span>
          </div>
          <span className="heading-display text-xl font-semibold">CloseIQ</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
            Sign In
          </Link>
          <Link
            to="/dashboard"
            className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-body"
          >
            Request Demo
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-16 py-20 lg:py-32 max-w-5xl mx-auto text-center animate-fade-in">
        <div className="badge-gold mb-6 mx-auto w-fit">AI-Powered Offer Intelligence</div>
        <h1 className="heading-display text-4xl lg:text-6xl font-semibold text-foreground leading-tight mb-6">
          Smarter Real Estate
          <br />
          Negotiations Start Here
        </h1>
        <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 font-body leading-relaxed">
          Turn messy offer packages into clear, confident decisions. CloseIQ extracts, compares, scores, and strategizes
          — so you close on the best terms, not just the highest price.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/new-analysis"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity font-body"
          >
            Start New Analysis <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 border border-border text-foreground px-6 py-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors font-body"
          >
            View Demo Dashboard
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 lg:px-16 py-16 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Brain, title: 'AI Extraction', desc: 'Automatically extract key terms from offer packages with confidence scoring.' },
            { icon: GitCompare, title: 'Side-by-Side Comparison', desc: 'Compare offers across price, risk, timing, and financial strength.' },
            { icon: Shield, title: 'Risk Intelligence', desc: 'Score every offer on close probability, contingency risk, and completeness.' },
            { icon: TrendingUp, title: 'Counter Strategy', desc: 'Generate data-driven counteroffer options that maximize seller outcomes.' },
          ].map((f) => (
            <div key={f.title} className="card-elevated p-6 animate-slide-up">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2 font-body">{f.title}</h3>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 lg:px-16 py-8 text-center">
        <p className="text-xs text-muted-foreground font-body">© 2026 CloseIQ — AI-Powered Offer Intelligence for Real Estate</p>
      </footer>
    </div>
  );
}
