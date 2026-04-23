import AppLayout from '@/components/AppLayout';
import { sampleProperty, formatCurrency } from '@/data/sampleData';
import { Award, Shield, TrendingUp, Target, AlertTriangle, ArrowRight, Download } from 'lucide-react';

export default function Report() {
  const offers = sampleProperty.offers;
  const best = offers[1]; // Chen — Best Balance
  const safest = offers[1]; // Chen
  const highest = offers[3]; // Ashford
  const bestFit = offers[0]; // Nakamura

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="heading-display text-2xl lg:text-3xl font-semibold mb-1">Recommendation Report</h1>
            <p className="text-muted-foreground font-body text-sm">{sampleProperty.address} · {sampleProperty.offers.length} offers analyzed</p>
          </div>
          <button className="hidden sm:flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium font-body hover:bg-muted transition-colors">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>

        {/* Hero cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card-elevated p-6 ring-2 ring-gold/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gold-light flex items-center justify-center">
                <Award className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-body">Best Overall Offer</p>
                <p className="text-base font-semibold font-body">{bestFit.buyerName}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-body leading-relaxed">
              All-cash at {formatCurrency(bestFit.offerPrice)} with minimal contingencies and a 21-day close. Strongest combination of price and execution certainty.
            </p>
          </div>
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-body">Safest Offer</p>
                <p className="text-base font-semibold font-body">{safest.buyerName}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-body leading-relaxed">
              100% complete package with pre-approval and full documentation. {formatCurrency(safest.offerPrice)} with {safest.scores.closeProbability}% close probability.
            </p>
          </div>
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-body">Highest Offer</p>
                <p className="text-base font-semibold font-body">{highest.buyerName}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-body leading-relaxed">
              {formatCurrency(highest.offerPrice)} — highest price but carries three contingencies, a 45-day close, and leaseback complexity. Elevated risk profile.
            </p>
          </div>
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gold-light flex items-center justify-center">
                <Target className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-body">Best Fit for Seller</p>
                <p className="text-base font-semibold font-body">{bestFit.buyerName}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-body leading-relaxed">
              Aligns with seller goals of fast close, strong price, and minimal negotiation risk. Cash offer with 7-day inspection only.
            </p>
          </div>
        </div>

        {/* Top Risks */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h3 className="heading-display text-lg font-semibold">Top Risks to Monitor</h3>
          </div>
          <ul className="space-y-3">
            {[
              'Offer D (Ashford) — Three contingencies create multiple failure points. 45-day timeline is the longest and introduces market risk.',
              'Offer C (Westside Holdings) — LLC structure requires additional verification. Operating agreement still pending review.',
              'Offer B (Chen) — Standard appraisal contingency could stall if property appraises below contract price.',
              'Market exposure — Extended negotiation period with multiple counters increases risk of buyer fatigue and withdrawal.',
            ].map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-sm font-body text-muted-foreground">
                <span className="text-warning mt-0.5">•</span>
                {risk}
              </li>
            ))}
          </ul>
        </div>

        {/* Best Negotiation Path */}
        <div className="card-elevated p-6">
          <h3 className="heading-display text-lg font-semibold mb-3">Recommended Negotiation Path</h3>
          <div className="space-y-3">
            {[
              'Counter Offer A (Nakamura Trust) at $9,050,000 with a 5-day inspection and 25-day close.',
              'Simultaneously counter Offer E (Kapoor) at $8,950,000 requiring appraisal gap verification.',
              'If Nakamura accepts, proceed to close. If not, Kapoor provides a strong fallback.',
              'Offer B (Chen) remains a safety net with the most complete package and highest certainty.',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary-foreground text-xs font-semibold">{i + 1}</span>
                </div>
                <p className="text-sm font-body">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Suggested Counter */}
        <div className="card-elevated p-6">
          <h3 className="heading-display text-lg font-semibold mb-3">Suggested Counter Strategy</h3>
          <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4">
            The <strong className="text-foreground">Best Balance</strong> strategy targets a counter at $8,950,000 with shortened contingencies, increased earnest money, and a 10-day rent-free leaseback. This approach optimizes for a combination of price, certainty, and seller flexibility.
          </p>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium font-body hover:opacity-90 transition-opacity">
            View Full Counter Strategy <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}