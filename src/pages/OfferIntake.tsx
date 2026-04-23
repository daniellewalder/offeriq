import AppLayout from '@/components/AppLayout';
import { sampleProperty, formatCurrency } from '@/data/sampleData';
import { CheckCircle, AlertCircle, Clock, FileText, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export default function OfferIntake() {
  const [expandedOffer, setExpandedOffer] = useState(sampleProperty.offers[0].id);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="heading-display text-2xl lg:text-3xl font-semibold mb-1">Offer Intake & Extraction</h1>
          <p className="text-muted-foreground font-body text-sm">{sampleProperty.address} — {sampleProperty.offers.length} offers received</p>
        </div>

        {sampleProperty.offers.map((offer) => {
          const isExpanded = expandedOffer === offer.id;
          return (
            <div key={offer.id} className="card-elevated overflow-hidden">
              <button
                onClick={() => setExpandedOffer(isExpanded ? '' : offer.id)}
                className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors text-left"
              >
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-semibold font-body">{offer.buyerName}</h3>
                    {offer.labels.map(l => (
                      <span key={l} className="badge-gold text-xs">{l}</span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground font-body">{offer.agentName} · {offer.agentBrokerage} · {formatCurrency(offer.offerPrice)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground font-body">Completeness</p>
                    <p className="text-sm font-semibold font-body">{offer.completeness}%</p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border p-5 space-y-6">
                  {/* Documents */}
                  <div>
                    <h4 className="text-sm font-semibold font-body mb-3">Uploaded Documents</h4>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {offer.documents.map((doc, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-body truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground font-body">{doc.category}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {doc.status === 'verified' ? (
                              <CheckCircle className="w-4 h-4 text-success" />
                            ) : doc.status === 'pending' ? (
                              <Clock className="w-4 h-4 text-warning" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-destructive" />
                            )}
                            <span className="text-xs text-muted-foreground font-body">{doc.confidence}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Extracted Terms */}
                  <div>
                    <h4 className="text-sm font-semibold font-body mb-3">Extracted Deal Terms</h4>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        { label: 'Offer Price', value: formatCurrency(offer.offerPrice), confidence: 98 },
                        { label: 'Financing', value: offer.financingType, confidence: 96 },
                        { label: 'Down Payment', value: `${formatCurrency(offer.downPayment)} (${offer.downPaymentPercent}%)`, confidence: 95 },
                        { label: 'Earnest Money', value: formatCurrency(offer.earnestMoney), confidence: 94 },
                        { label: 'Contingencies', value: offer.contingencies.join(', ') || 'None', confidence: offer.contingencies.length > 0 ? 92 : 98 },
                        { label: 'Inspection Period', value: offer.inspectionPeriod, confidence: 93 },
                        { label: 'Appraisal Terms', value: offer.appraisalTerms, confidence: 90 },
                        { label: 'Close Timeline', value: offer.closeTimeline, confidence: 97 },
                        { label: 'Leaseback', value: offer.leasebackRequest, confidence: 88 },
                        { label: 'Concessions', value: offer.concessions, confidence: 91 },
                        { label: 'Proof of Funds', value: offer.proofOfFunds ? 'Present' : 'Missing', confidence: offer.proofOfFunds ? 96 : 0 },
                        { label: 'Pre-Approval', value: offer.preApproval ? 'Present' : 'N/A', confidence: offer.preApproval ? 95 : 0 },
                      ].map((field) => (
                        <div key={field.label} className={`p-3 rounded-lg border ${field.confidence >= 90 ? 'border-border bg-card' : field.confidence >= 70 ? 'border-warning/30 bg-warning/5' : 'border-destructive/30 bg-destructive/5'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground font-body">{field.label}</span>
                            <span className={`text-xs font-body ${field.confidence >= 90 ? 'text-success' : field.confidence >= 70 ? 'text-warning' : 'text-destructive'}`}>
                              {field.confidence > 0 ? `${field.confidence}%` : '—'}
                            </span>
                          </div>
                          <p className="text-sm font-medium font-body">{field.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {offer.specialNotes && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground font-body mb-1">Special Notes</p>
                      <p className="text-sm font-body">{offer.specialNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}