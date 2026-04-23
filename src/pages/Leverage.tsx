import AppLayout from '@/components/AppLayout';
import { Lightbulb, ArrowRight } from 'lucide-react';

const leveragePoints = [
  {
    title: 'Trade a short leaseback for a firmer price',
    description: 'Here\'s a move that works almost every time in luxury deals: offer the buyer a 7–14 day rent-free leaseback. It costs them essentially nothing, but it gives you leverage to hold firm on price or push back on concessions. Buyers see it as a win. You know it\'s a rounding error on a $9M deal. Classic give-to-get.',
    tags: ['High Seller Impact', 'Low Buyer Friction', 'Likely Acceptance Booster'],
    applicableTo: ['Offer B', 'Offer E'],
  },
  {
    title: 'Tighten the inspection window',
    description: 'A 17-day inspection on a well-maintained Bel Air property is generous — too generous. Serious buyers at this level know what they\'re getting into. Asking for 5–7 days signals you expect commitment, and it shrinks the window where they can renegotiate based on minor findings. Buyers who balk at this probably weren\'t going to close cleanly anyway.',
    tags: ['High Seller Impact', 'Strong Counter Candidate'],
    applicableTo: ['Offer B', 'Offer D', 'Offer E'],
  },
  {
    title: 'Push earnest money to $250K+',
    description: 'At this price point, a $150K deposit doesn\'t signal much conviction. Bumping to $250K or higher costs a well-qualified buyer nothing — the money sits in escrow and comes back at close. But it creates real skin in the game and makes walking away genuinely expensive. It\'s the simplest way to test whether a buyer is serious or just shopping.',
    tags: ['High Seller Impact', 'Low Buyer Friction'],
    applicableTo: ['Offer B', 'Offer D', 'Offer E'],
  },
  {
    title: 'Give on timeline, hold on price',
    description: 'The Nakamura Trust wants 21 days. Westside wants 14. Instead of countering on their number, give them the close date they asked for — and hold firm on everything else. Buyers almost always value certainty on timing more than they\'ll admit. You\'re giving them something that feels significant but doesn\'t cost you a dollar.',
    tags: ['Low Buyer Friction', 'Likely Acceptance Booster'],
    applicableTo: ['Offer A', 'Offer C'],
  },
  {
    title: 'Take repair negotiations off the table',
    description: 'Post-inspection repair requests are where good deals go sideways. Consider countering with "sold as-is" — but pair it with a small price adjustment so the buyer doesn\'t feel like they\'re taking on blind risk. You avoid the back-and-forth over $15K in cosmetic fixes that can delay closing by weeks.',
    tags: ['High Seller Impact', 'Strong Counter Candidate'],
    applicableTo: ['Offer B', 'Offer D'],
  },
  {
    title: 'Require appraisal gap coverage on financed offers',
    description: 'This is the single biggest risk with financed offers in luxury markets — the appraisal comes in low and the whole deal unravels. The Kapoors already volunteered gap coverage, which shows sophistication. For the Chen and Ashford offers, making this a counter-requirement isn\'t unreasonable. If they can\'t commit to covering a gap, that tells you something about their ceiling.',
    tags: ['High Seller Impact', 'Strong Counter Candidate'],
    applicableTo: ['Offer B', 'Offer D'],
  },
];

const tagColors: Record<string, string> = {
  'High Seller Impact': 'badge-gold',
  'Low Buyer Friction': 'badge-success',
  'Strong Counter Candidate': 'badge-info',
  'Likely Acceptance Booster': 'badge-warning',
};

export default function Leverage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="mb-2">
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Negotiation</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Leverage Points</h1>
        </div>

        <div className="space-y-4">
          {leveragePoints.map((lp, i) => (
            <div key={i} className="card-elevated p-6 lg:p-7 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Lightbulb className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[13px] font-medium font-body mb-1.5">{lp.title}</h3>
                  <p className="text-[13px] text-muted-foreground font-body leading-relaxed">{lp.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 ml-12">
                {lp.tags.map(t => (
                  <span key={t} className={`${tagColors[t] ?? 'badge-info'} text-xs`}>{t}</span>
                ))}
                <span className="text-xs text-muted-foreground font-body ml-2">
                  <ArrowRight className="w-3 h-3 inline mr-1" />
                  {lp.applicableTo.join(', ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}