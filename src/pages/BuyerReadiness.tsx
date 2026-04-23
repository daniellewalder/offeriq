import { useState, useRef, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { formatCurrency } from '@/data/sampleData';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle, AlertTriangle, XCircle, Upload, ArrowRight,
  Loader2, FileText, X, Brain, TrendingUp, Shield, Clock,
  ShieldCheck, FileCheck, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/* ── Types ── */
interface ChecklistItem { item: string; status: 'complete' | 'warning' | 'missing'; note: string; }
interface MissingItem { item: string; impact: string; urgency: 'critical' | 'important' | 'minor'; }
interface WeakPoint { issue: string; why_it_matters: string; fix: string; }
interface Improvement { action: string; priority: 'high' | 'medium' | 'low'; reasoning: string; }
interface Scores { offer_strength: number; financial_confidence: number; contingency_risk: number; timing_risk: number; package_completeness: number; close_probability: number; }
interface Analysis {
  submission_confidence_score: number;
  checklist: ChecklistItem[];
  missing_items: MissingItem[];
  weak_points: WeakPoint[];
  strengths: string[];
  recommended_improvements: Improvement[];
  overall_summary: string;
  scores: Scores;
}

interface DocFile { file: File; category: string; }

const CATEGORIES = ['Purchase Agreement', 'Pre-Approval', 'Proof of Funds', 'Proof of Income', 'Addenda', 'Disclosures', 'Cover Letter', 'Other'];

const statusIcon = { complete: CheckCircle, warning: AlertTriangle, missing: XCircle };
const statusColor = { complete: 'text-success', warning: 'text-warning', missing: 'text-destructive' };
const statusBg = { complete: 'bg-success/5 border-success/20', warning: 'bg-warning/5 border-warning/20', missing: 'bg-destructive/5 border-destructive/20' };
const urgencyColor = { critical: 'text-destructive', important: 'text-warning', minor: 'text-muted-foreground' };
const priorityBadge = { high: 'badge-gold', medium: 'badge-warning', low: 'badge-info' };

const scoreLabels: { key: keyof Scores; label: string; icon: typeof TrendingUp; isRisk: boolean }[] = [
  { key: 'offer_strength', label: 'Offer Strength', icon: TrendingUp, isRisk: false },
  { key: 'close_probability', label: 'Close Probability', icon: Shield, isRisk: false },
  { key: 'financial_confidence', label: 'Financial Confidence', icon: ShieldCheck, isRisk: false },
  { key: 'contingency_risk', label: 'Contingency Risk', icon: AlertTriangle, isRisk: true },
  { key: 'timing_risk', label: 'Timing Risk', icon: Clock, isRisk: true },
  { key: 'package_completeness', label: 'Package Completeness', icon: FileCheck, isRisk: false },
];

const scoreColor = (v: number, isRisk: boolean) => {
  if (isRisk) return v <= 20 ? 'text-success' : v <= 40 ? 'text-warning' : 'text-destructive';
  return v >= 80 ? 'text-success' : v >= 60 ? 'text-warning' : 'text-destructive';
};
const scoreBarColor = (v: number, isRisk: boolean) => {
  if (isRisk) return v <= 20 ? 'bg-success' : v <= 40 ? 'bg-warning' : 'bg-destructive';
  return v >= 80 ? 'bg-success' : v >= 60 ? 'bg-warning' : 'bg-destructive';
};

export default function BuyerReadiness() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Offer form state ── */
  const [offerPrice, setOfferPrice] = useState('');
  const [financingType, setFinancingType] = useState('Conventional');
  const [downPaymentPct, setDownPaymentPct] = useState('20');
  const [earnestMoney, setEarnestMoney] = useState('');
  const [closeDays, setCloseDays] = useState('30');
  const [inspectionDays, setInspectionDays] = useState('10');
  const [appraisalTerms, setAppraisalTerms] = useState('Standard');
  const [leaseback, setLeaseback] = useState('None');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [listingPrice, setListingPrice] = useState('');

  /* ── Documents ── */
  const [docs, setDocs] = useState<DocFile[]>([]);
  const addFiles = useCallback((files: FileList | File[]) => {
    const newDocs = Array.from(files).map(f => ({ file: f, category: guessCategory(f.name) }));
    setDocs(prev => [...prev, ...newDocs]);
  }, []);
  const removeDoc = (i: number) => setDocs(prev => prev.filter((_, j) => j !== i));
  const updateCategory = (i: number, cat: string) => setDocs(prev => prev.map((d, j) => j === i ? { ...d, category: cat } : d));

  /* ── AI state ── */
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('checklist');

  const runReview = async () => {
    if (!offerPrice) {
      toast({ title: 'Missing offer price', description: 'Enter the offer price to run the review.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const offer = {
        offer_price: parseFloat(offerPrice),
        financing_type: financingType,
        down_payment_percent: parseFloat(downPaymentPct),
        earnest_money: earnestMoney ? parseFloat(earnestMoney) : undefined,
        close_days: parseInt(closeDays),
        inspection_days: parseInt(inspectionDays),
        appraisal_terms: appraisalTerms,
        leaseback_request: leaseback,
        proof_of_funds: docs.some(d => d.category === 'Proof of Funds'),
        pre_approval: docs.some(d => d.category === 'Pre-Approval'),
      };
      const documents = docs.map(d => ({ name: d.file.name, category: d.category, size: d.file.size }));
      const property = {
        address: propertyAddress || 'Not specified',
        listingPrice: listingPrice ? parseFloat(listingPrice) : undefined,
      };

      const response = await fetch(`${SUPABASE_URL}/functions/v1/review-package`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(SUPABASE_KEY ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
        },
        body: JSON.stringify({ offer, documents, property }),
      });

      const data = await response.json();
      if (!response.ok || data?.error) {
        toast({ title: 'Review Error', description: data?.error || 'AI review failed', variant: 'destructive' });
      } else if (data?.analysis) {
        setAnalysis(data.analysis);
        setExpandedSection('checklist');
      }
    } catch (e: any) {
      toast({ title: 'Review Failed', description: e.message || 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const confidenceColor = (s: number) => s >= 80 ? 'border-success text-success' : s >= 60 ? 'border-warning text-warning' : 'border-destructive text-destructive';
  const confidenceBg = (s: number) => s >= 80 ? 'bg-success' : s >= 60 ? 'bg-warning' : 'bg-destructive';

  const SectionToggle = ({ id, label, count }: { id: string; label: string; count?: number }) => (
    <button
      onClick={() => setExpandedSection(expandedSection === id ? null : id)}
      className="w-full flex items-center justify-between py-3 text-left"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">{label}</span>
        {count !== undefined && <span className="text-[10px] text-muted-foreground font-body bg-muted px-1.5 py-0.5 rounded-sm">{count}</span>}
      </div>
      {expandedSection === id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Buyer Side</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Offer Readiness Check</h1>
          <p className="text-[13px] text-muted-foreground font-body mt-2 max-w-2xl">
            Enter your offer terms and upload documents. AI reviews your package the way a top listing agent would — and tells you exactly how to strengthen it before you submit.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* ── Left: Offer Terms ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Property info */}
            <div className="space-y-3">
              <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">Property</p>
              <input type="text" placeholder="Property address" value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-border rounded-sm text-[13px] font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent" />
              <input type="text" placeholder="Listing price" value={listingPrice} onChange={e => setListingPrice(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-border rounded-sm text-[13px] font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent" />
            </div>

            {/* Offer terms */}
            <div className="space-y-3">
              <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">Offer Terms</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground font-body mb-1 block">Offer Price *</label>
                  <input type="text" placeholder="$0" value={offerPrice} onChange={e => setOfferPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-sm text-[13px] font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-body mb-1 block">Financing</label>
                  <select value={financingType} onChange={e => setFinancingType(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-sm text-[13px] font-body text-foreground focus:outline-none focus:border-accent">
                    <option>Conventional</option>
                    <option>All Cash</option>
                    <option>FHA</option>
                    <option>VA</option>
                    <option>Jumbo Loan</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-body mb-1 block">Down Payment %</label>
                  <input type="text" placeholder="20" value={downPaymentPct} onChange={e => setDownPaymentPct(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-sm text-[13px] font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-body mb-1 block">Earnest Money</label>
                  <input type="text" placeholder="$0" value={earnestMoney} onChange={e => setEarnestMoney(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-sm text-[13px] font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-body mb-1 block">Close (days)</label>
                  <input type="text" placeholder="30" value={closeDays} onChange={e => setCloseDays(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-sm text-[13px] font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-body mb-1 block">Inspection (days)</label>
                  <input type="text" placeholder="10" value={inspectionDays} onChange={e => setInspectionDays(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-sm text-[13px] font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground font-body mb-1 block">Appraisal</label>
                  <select value={appraisalTerms} onChange={e => setAppraisalTerms(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-sm text-[13px] font-body text-foreground focus:outline-none focus:border-accent">
                    <option>Standard</option>
                    <option>Waived</option>
                    <option>Gap Coverage</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-body mb-1 block">Leaseback</label>
                  <select value={leaseback} onChange={e => setLeaseback(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-sm text-[13px] font-body text-foreground focus:outline-none focus:border-accent">
                    <option>None</option>
                    <option>7-day rent-free</option>
                    <option>14-day rent-free</option>
                    <option>30-day rent-free</option>
                    <option>30-day at market rate</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Document upload */}
            <div className="space-y-3">
              <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium">Documents</p>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-md p-6 text-center hover:border-accent/40 transition-colors cursor-pointer"
              >
                <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-[12px] font-medium font-body text-foreground">Drop files or click to upload</p>
                <p className="text-[10px] text-muted-foreground font-body mt-0.5">Purchase agreement, pre-approval, proof of funds, etc.</p>
              </div>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={e => e.target.files && addFiles(e.target.files)} />

              {docs.length > 0 && (
                <div className="space-y-1.5">
                  {docs.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-card border border-border/60 rounded-sm">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                      <span className="text-[12px] font-body text-foreground truncate flex-1">{d.file.name}</span>
                      <select value={d.category} onChange={e => updateCategory(i, e.target.value)}
                        className="text-[10px] font-body bg-muted border-none rounded-sm px-1.5 py-0.5 text-foreground">
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <button onClick={() => removeDoc(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Run button */}
            <button
              onClick={runReview}
              disabled={loading || !offerPrice}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-accent text-accent-foreground rounded-sm text-[13px] font-body font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {loading ? 'Reviewing Package…' : analysis ? 'Re-run Review' : 'Run AI Readiness Check'}
            </button>
          </div>

          {/* ── Right: Results ── */}
          <div className="lg:col-span-3">
            {!analysis && !loading && (
              <div className="rounded-md border border-border/40 bg-card p-10 text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-[14px] font-body font-medium text-foreground mb-1">No review yet</p>
                <p className="text-[12px] text-muted-foreground font-body max-w-sm mx-auto">
                  Enter your offer terms and upload documents, then hit "Run AI Readiness Check" to get a full package assessment.
                </p>
              </div>
            )}

            {loading && (
              <div className="rounded-md border border-accent/30 bg-accent/[0.03] p-10 text-center">
                <Loader2 className="w-8 h-8 text-accent mx-auto mb-4 animate-spin" />
                <p className="text-[14px] font-body font-medium text-foreground mb-1">Reviewing your offer package…</p>
                <p className="text-[12px] text-muted-foreground font-body">AI is analyzing terms, documents, and competitiveness</p>
              </div>
            )}

            {analysis && !loading && (
              <div className="space-y-4 animate-fade-in">
                {/* Confidence Score */}
                <div className="rounded-md border border-border/60 bg-card p-6">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-md border-2 flex items-center justify-center ${confidenceColor(analysis.submission_confidence_score)}`}>
                      <span className="heading-display text-2xl">{analysis.submission_confidence_score}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body font-medium mb-1">Submission Confidence</p>
                      <p className="text-[13px] text-muted-foreground font-body leading-relaxed">{analysis.overall_summary}</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-4">
                    <div className={`h-full rounded-full transition-all duration-700 ${confidenceBg(analysis.submission_confidence_score)}`} style={{ width: `${analysis.submission_confidence_score}%` }} />
                  </div>
                </div>

                {/* Score Cards */}
                <div className="grid grid-cols-3 gap-2">
                  {scoreLabels.map(s => {
                    const val = analysis.scores[s.key];
                    return (
                      <div key={s.key} className="rounded-md border border-border/40 bg-card p-3 text-center">
                        <s.icon className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1.5" strokeWidth={1.5} />
                        <p className={`heading-display text-xl ${scoreColor(val, s.isRisk)}`}>{val}</p>
                        <p className="text-[9px] tracking-[0.1em] uppercase text-muted-foreground font-body mt-0.5">{s.label}</p>
                        <div className="h-0.5 bg-muted rounded-full overflow-hidden mt-2">
                          <div className={`h-full rounded-full ${scoreBarColor(val, s.isRisk)}`} style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Checklist */}
                <div className="rounded-md border border-border/60 bg-card">
                  <div className="px-5">
                    <SectionToggle id="checklist" label="Package Checklist" count={analysis.checklist.length} />
                  </div>
                  {expandedSection === 'checklist' && (
                    <div className="px-5 pb-4 space-y-2 border-t border-border/30 pt-3">
                      {analysis.checklist.map((item, i) => {
                        const Icon = statusIcon[item.status];
                        return (
                          <div key={i} className={`rounded-sm border p-3 ${statusBg[item.status]}`}>
                            <div className="flex items-start gap-2.5">
                              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${statusColor[item.status]}`} />
                              <div>
                                <p className="text-[12px] font-medium font-body text-foreground">{item.item}</p>
                                <p className="text-[11px] text-muted-foreground font-body mt-0.5 leading-relaxed">{item.note}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Strengths */}
                {analysis.strengths.length > 0 && (
                  <div className="rounded-md border border-success/20 bg-success/[0.03] p-5">
                    <p className="text-[10px] tracking-[0.15em] uppercase text-success font-body font-medium mb-3">Strengths</p>
                    <div className="space-y-1.5">
                      {analysis.strengths.map((s, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0" />
                          <p className="text-[12px] font-body text-foreground leading-relaxed">{s}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weak Points */}
                {analysis.weak_points.length > 0 && (
                  <div className="rounded-md border border-border/60 bg-card">
                    <div className="px-5">
                      <SectionToggle id="weak" label="Weak Points" count={analysis.weak_points.length} />
                    </div>
                    {expandedSection === 'weak' && (
                      <div className="px-5 pb-4 space-y-2 border-t border-border/30 pt-3">
                        {analysis.weak_points.map((wp, i) => (
                          <div key={i} className="rounded-sm border border-warning/20 bg-warning/[0.03] p-3 space-y-1.5">
                            <p className="text-[12px] font-medium font-body text-foreground">{wp.issue}</p>
                            <p className="text-[11px] text-muted-foreground font-body leading-relaxed">{wp.why_it_matters}</p>
                            <div className="flex items-start gap-1.5 mt-1">
                              <ArrowRight className="w-3 h-3 text-accent mt-0.5 flex-shrink-0" />
                              <p className="text-[11px] text-accent font-body font-medium">{wp.fix}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Missing Items */}
                {analysis.missing_items.length > 0 && (
                  <div className="rounded-md border border-border/60 bg-card">
                    <div className="px-5">
                      <SectionToggle id="missing" label="Missing Items" count={analysis.missing_items.length} />
                    </div>
                    {expandedSection === 'missing' && (
                      <div className="px-5 pb-4 space-y-2 border-t border-border/30 pt-3">
                        {analysis.missing_items.map((mi, i) => (
                          <div key={i} className="rounded-sm border border-destructive/20 bg-destructive/[0.03] p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                              <p className="text-[12px] font-medium font-body text-foreground">{mi.item}</p>
                              <span className={`text-[9px] tracking-[0.1em] uppercase font-body font-medium ${urgencyColor[mi.urgency]}`}>{mi.urgency}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground font-body leading-relaxed ml-[22px]">{mi.impact}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recommendations */}
                <div className="rounded-md border border-border/60 bg-card">
                  <div className="px-5">
                    <SectionToggle id="recs" label="How to Strengthen This Offer" count={analysis.recommended_improvements.length} />
                  </div>
                  {expandedSection === 'recs' && (
                    <div className="px-5 pb-4 space-y-2 border-t border-border/30 pt-3">
                      {analysis.recommended_improvements.map((rec, i) => (
                        <div key={i} className="rounded-sm border border-border/40 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-body font-medium ${priorityBadge[rec.priority]}`}>{rec.priority}</span>
                            <p className="text-[12px] font-medium font-body text-foreground">{rec.action}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-body leading-relaxed">{rec.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

/* ── Helpers ── */
function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('purchase') || n.includes('agreement') || n.includes('contract')) return 'Purchase Agreement';
  if (n.includes('pre-approval') || n.includes('preapproval') || n.includes('pre_approval')) return 'Pre-Approval';
  if (n.includes('fund') || n.includes('bank') || n.includes('statement')) return 'Proof of Funds';
  if (n.includes('income') || n.includes('w2') || n.includes('w-2') || n.includes('tax')) return 'Proof of Income';
  if (n.includes('addend')) return 'Addenda';
  if (n.includes('disclos')) return 'Disclosures';
  if (n.includes('cover') || n.includes('letter')) return 'Cover Letter';
  return 'Other';
}