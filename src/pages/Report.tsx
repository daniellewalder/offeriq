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
            <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Report</p>
            <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Recommendation Report</h1>
            <p className="text-[13px] text-muted-foreground font-body mt-2">{sampleProperty.address} · {sampleProperty.offers.length} offers analyzed</p>
          </div>
          <button className="hidden sm:flex items-center gap-2 px-4 py-2 border border-border rounded-sm text-[12px] font-medium font-body hover:bg-muted/50 transition-colors tracking-wide">
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
              This is the offer you\'d write if you could design one from scratch. All-cash at {formatCurrency(bestFit.offerPrice)}, one short contingency, and a 21-day close. The Nakamura Trust is relocating and motivated — the kind of buyer who doesn\'t play games.
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
              If certainty is what matters most, the Chens are your answer. Every document in order, First Republic pre-approval, and a {safest.scores.closeProbability}% close probability. At {formatCurrency(safest.offerPrice)}, the price is strong — and you can actually count on it reaching the finish line.
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
              {formatCurrency(highest.offerPrice)} is the biggest number on the table, but it comes with baggage — three contingencies, a 45-day runway, and a leaseback that adds complexity. The price is appealing; the question is whether you\'re willing to spend two months finding out if it actually closes.
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
              When you map this against what the seller actually cares about — fast close, strong price, no repair drama — the Nakamura Trust checks every box. Cash, minimal contingencies, and a buyer who needs to close.
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
              'The Ashford offer looks great at $9.25M, but three contingencies over 45 days means you\'re essentially giving the buyer a month and a half of free optionality. If the market softens or they get cold feet, they have multiple clean exit points.',
              'Westside Holdings is an LLC — and the operating agreement still hasn\'t been reviewed. Until you know who\'s actually behind this entity and how decisions get made, there\'s an unresolved question mark on this deal.',
              'The Chen offer has a standard appraisal contingency, and luxury comps in Bel Air can be thin. If the appraisal comes in low, you\'re back at the negotiating table. Consider requesting gap coverage in any counter.',
              'Be mindful of timeline — juggling multiple counters increases the risk of buyer fatigue. The strongest buyers won\'t wait around indefinitely. Move with purpose.',
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
          <h3 className="heading-display text-lg font-semibold mb-3">How We\'d Play This</h3>
          <div className="space-y-3">
            {[
              'Lead with the Nakamura Trust. Counter at $9.05M, tighten inspection to 5 days, and offer the 7-day leaseback. They\'re motivated and cash — this is your best path to top dollar.',
              'Run a parallel counter to the Kapoors at $8.95M. Require written confirmation of their appraisal gap coverage. If Nakamura falls through, you want this locked and ready.',
              'If Nakamura accepts, you\'re done — best price, fastest close, cleanest deal. If they counter back, you have the Kapoors as a strong fallback without losing momentum.',
              'Keep the Chens in your back pocket. They\'re not going anywhere — their package is complete and they\'re flexible on timeline. If everything else falls apart, this is the deal that still closes.',
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
          <h3 className="heading-display text-lg font-semibold mb-3">The Bottom Line</h3>
          <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4">
            You have five real offers on a property that\'s been well-received by the market. The strongest play is to counter Nakamura aggressively on terms while keeping the Kapoors as a live backup. Don\'t get distracted by Ashford\'s headline number — the execution risk isn\'t worth it unless they\'re willing to drop at least two contingencies. And if certainty matters more than squeezing out every last dollar, the Chens are sitting right there with a bulletproof package.
          </p>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium font-body hover:opacity-90 transition-opacity">
            View Full Counter Strategy <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}