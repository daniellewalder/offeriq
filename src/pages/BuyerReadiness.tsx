import AppLayout from '@/components/AppLayout';
import { CheckCircle, AlertTriangle, XCircle, Upload, ArrowRight } from 'lucide-react';

const checklistItems = [
  { label: 'Purchase Agreement', status: 'complete' as const, note: 'All required fields filled. Offer price, terms, and signatures present.' },
  { label: 'Pre-Approval Letter', status: 'warning' as const, note: 'Letter is 45 days old. Recommend requesting an updated letter within 5 days of submission.' },
  { label: 'Proof of Funds', status: 'complete' as const, note: 'Chase Private Client statement dated within 14 days. Sufficient funds verified.' },
  { label: 'Proof of Income', status: 'complete' as const, note: 'W-2s and tax returns for past 2 years included.' },
  { label: 'Earnest Money Commitment', status: 'warning' as const, note: 'Current deposit of $150K is below competitive threshold for this price range. Recommend $200K+.' },
  { label: 'Buyer Cover Letter', status: 'missing' as const, note: 'No personal letter included. In competitive situations, a well-crafted letter can differentiate.' },
  { label: 'Contingency Terms', status: 'warning' as const, note: '17-day inspection period is longer than market standard. Consider shortening to 10 days.' },
  { label: 'Appraisal Gap Coverage', status: 'missing' as const, note: 'No gap coverage offered. Adding $150K–$200K coverage would significantly strengthen this offer.' },
  { label: 'Close Timeline', status: 'complete' as const, note: '30-day close aligns with seller preferences per comparable listings.' },
  { label: 'Disclosures Acknowledgment', status: 'complete' as const, note: 'All seller disclosures reviewed and acknowledged.' },
];

const statusIcon = { complete: CheckCircle, warning: AlertTriangle, missing: XCircle };
const statusColor = { complete: 'text-success', warning: 'text-warning', missing: 'text-destructive' };
const statusBg = { complete: 'bg-success/5 border-success/20', warning: 'bg-warning/5 border-warning/20', missing: 'bg-destructive/5 border-destructive/20' };

const completeCount = checklistItems.filter(i => i.status === 'complete').length;
const confidenceScore = Math.round((completeCount / checklistItems.length) * 100 - checklistItems.filter(i => i.status === 'missing').length * 5);

export default function BuyerReadiness() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="heading-display text-2xl lg:text-3xl font-semibold mb-1">Buyer Offer Readiness</h1>
          <p className="text-muted-foreground font-body text-sm">Review and strengthen your offer package before submission.</p>
        </div>

        {/* Upload area */}
        <div className="card-elevated p-6">
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-gold/40 transition-colors cursor-pointer">
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium font-body mb-1">Upload Your Offer Package</p>
            <p className="text-xs text-muted-foreground font-body">Drop all documents for AI review</p>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="card-elevated p-6 flex items-center gap-6">
          <div className={`score-ring text-lg border-2 ${confidenceScore >= 80 ? 'border-success text-success' : confidenceScore >= 60 ? 'border-warning text-warning' : 'border-destructive text-destructive'}`}>
            {confidenceScore}
          </div>
          <div>
            <h3 className="text-base font-semibold font-body">Submission Confidence Score</h3>
            <p className="text-sm text-muted-foreground font-body">
              {completeCount} of {checklistItems.length} items complete. {checklistItems.filter(i => i.status === 'missing').length} items missing, {checklistItems.filter(i => i.status === 'warning').length} items need attention.
            </p>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-3">
          {checklistItems.map((item) => {
            const Icon = statusIcon[item.status];
            return (
              <div key={item.label} className={`card-elevated p-4 border ${statusBg[item.status]}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${statusColor[item.status]}`} />
                  <div>
                    <p className="text-sm font-semibold font-body">{item.label}</p>
                    <p className="text-sm text-muted-foreground font-body mt-0.5 leading-relaxed">{item.note}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recommendations */}
        <div className="card-elevated p-6">
          <h3 className="heading-display text-lg font-semibold mb-3">Recommendations to Strengthen</h3>
          <ul className="space-y-2">
            {[
              'Request an updated pre-approval letter dated within 7 days of submission.',
              'Increase earnest money deposit to $200,000+ to demonstrate seriousness.',
              'Add appraisal gap coverage of $150K–$200K to protect against low appraisal.',
              'Include a concise, professional buyer cover letter highlighting commitment.',
              'Consider shortening inspection contingency to 10 days to match competitive offers.',
            ].map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm font-body">
                <ArrowRight className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}