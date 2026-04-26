import AppLayout from '@/components/AppLayout';
import { sampleProperty, formatCurrency } from '@/data/sampleData';
import {
  CheckCircle, AlertCircle, Clock, FileText, ChevronDown, Upload,
  Plus, Shield, Eye, AlertTriangle, Sparkles, X, Info, Brain, Loader2, Target, TrendingUp, AlertOctagon
} from 'lucide-react';
import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  getOrCreateDemoAnalysis,
  createOffer,
  uploadDocument,
  triggerExtraction,
} from '@/lib/offerService';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// --------------- types ---------------

const DOC_CATEGORIES = [
  'Purchase Agreement',
  'Proof of Funds',
  'Pre-Approval',
  'Proof of Income',
  'Addenda',
  'Disclosures',
  'Other',
] as const;

type DocCategory = typeof DOC_CATEGORIES[number];

interface UploadedDoc {
  id: string;
  file: File;
  category: DocCategory;
  status: 'uploading' | 'extracting' | 'complete' | 'error';
  progress: number;
  dbDocId?: string;
}

interface ExtractionField {
  value: string | number | boolean | string[] | null;
  confidence: number;
  evidence: string | null;
}

interface ExtractionResult {
  [key: string]: ExtractionField;
}

interface OfferPackage {
  id: string;
  name: string;
  documents: UploadedDoc[];
  extraction: ExtractionResult | null;
  status: 'uploading' | 'extracting' | 'complete' | 'idle';
  dbOfferId?: string;
  dbExtractionResult?: any;
}

// --------------- mock extraction ---------------

const MOCK_EXTRACTION: ExtractionResult = {
  buyer_name: { value: 'Jonathan & Claire Whitfield', confidence: 0.98, evidence: 'Buyer: Jonathan M. Whitfield and Claire A. Whitfield, as joint tenants' },
  property_address: { value: '1247 Stone Canyon Rd, Bel Air, CA 90077', confidence: 0.99, evidence: 'Property Address: 1247 Stone Canyon Road, Bel Air, California 90077' },
  offer_price: { value: 8950000, confidence: 0.99, evidence: 'Purchase Price: Eight Million Nine Hundred Fifty Thousand Dollars ($8,950,000)' },
  financing_type: { value: 'Conventional — 25% Down', confidence: 0.95, evidence: 'Type of financing: Conventional mortgage, 75% LTV' },
  loan_amount: { value: 6712500, confidence: 0.93, evidence: 'Loan amount shall not exceed $6,712,500' },
  down_payment_amount: { value: 2237500, confidence: 0.94, evidence: 'Down payment of $2,237,500 (25% of purchase price)' },
  down_payment_percent: { value: 25, confidence: 0.96, evidence: 'Down payment of $2,237,500 (25% of purchase price)' },
  earnest_money_deposit: { value: 200000, confidence: 0.97, evidence: 'Initial deposit of $200,000 within 3 business days of acceptance' },
  close_of_escrow_days: { value: 30, confidence: 0.96, evidence: 'Close of escrow shall be 30 days after acceptance' },
  requested_close_date: { value: null, confidence: 0.0, evidence: null },
  inspection_contingency_present: { value: true, confidence: 0.98, evidence: 'Buyer shall have the right to conduct inspections within 10 days' },
  inspection_contingency_days: { value: 10, confidence: 0.97, evidence: 'inspection period of ten (10) calendar days' },
  appraisal_contingency_present: { value: true, confidence: 0.92, evidence: 'This offer is contingent upon the property appraising at or above the purchase price' },
  appraisal_contingency_days: { value: 17, confidence: 0.88, evidence: 'Appraisal contingency shall be removed within 17 days' },
  loan_contingency_present: { value: true, confidence: 0.91, evidence: 'Loan contingency period: 21 days from acceptance' },
  loan_contingency_days: { value: 21, confidence: 0.90, evidence: 'Loan contingency period: 21 days from acceptance' },
  leaseback_requested: { value: true, confidence: 0.85, evidence: 'Seller may occupy the property for up to 14 days after close at no cost' },
  leaseback_days: { value: 14, confidence: 0.84, evidence: 'up to 14 days after close' },
  seller_credit_requested: { value: null, confidence: 0.0, evidence: null },
  repairs_requested: { value: null, confidence: 0.0, evidence: null },
  proof_of_funds_present: { value: true, confidence: 0.96, evidence: 'Attached: Bank statement from Chase Private Client dated April 2026' },
  proof_of_income_present: { value: true, confidence: 0.91, evidence: 'Attached: 2025 W-2 and two most recent pay stubs' },
  preapproval_present: { value: true, confidence: 0.95, evidence: 'Pre-approval letter from First Republic Bank dated April 18, 2026' },
  lender_name: { value: 'First Republic Bank', confidence: 0.94, evidence: 'Pre-approval letter from First Republic Bank' },
  addenda_present: { value: true, confidence: 0.87, evidence: 'Addendum A: Leaseback Agreement' },
  disclosure_acknowledgment_present: { value: true, confidence: 0.82, evidence: 'Buyer acknowledges receipt of Transfer Disclosure Statement' },
  occupancy_terms: { value: 'Buyer intends to occupy as primary residence', confidence: 0.78, evidence: 'Buyer represents that the property will be their primary residence' },
  special_requests: { value: null, confidence: 0.0, evidence: null },
  package_completeness: { value: '92%', confidence: 0.90, evidence: null },
  missing_items: { value: ['Specific close date not stated', 'No seller credit or repair language'], confidence: 0.85, evidence: null },
  notable_risks: { value: ['Three active contingencies increase fall-through risk', 'Appraisal contingency on a financed offer at this price point'], confidence: 0.88, evidence: null },
  notable_strengths: { value: ['Strong proof of funds from Chase Private Client', 'Rent-free leaseback offered without prompting', 'Complete documentation package'], confidence: 0.92, evidence: null },
};

// --------------- helpers ---------------

const confidenceColor = (c: number) => {
  if (c >= 0.9) return 'text-success';
  if (c >= 0.7) return 'text-warning';
  if (c > 0) return 'text-destructive';
  return 'text-muted-foreground';
};

const confidenceBg = (c: number) => {
  if (c >= 0.9) return 'border-success/20 bg-success/5';
  if (c >= 0.7) return 'border-warning/20 bg-warning/5';
  if (c > 0) return 'border-destructive/20 bg-destructive/5';
  return 'border-border bg-muted/30';
};

const fieldLabel = (key: string) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const formatValue = (v: ExtractionField['value']): string => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.join('; ');
  if (typeof v === 'number' && v > 10000) return formatCurrency(v);
  return String(v);
};

// Field groupings for display
const FIELD_GROUPS: { title: string; icon: typeof Shield; fields: string[] }[] = [
  {
    title: 'Core Terms',
    icon: FileText,
    fields: ['buyer_name', 'property_address', 'offer_price', 'financing_type', 'loan_amount', 'down_payment_amount', 'down_payment_percent', 'earnest_money_deposit'],
  },
  {
    title: 'Timeline & Contingencies',
    icon: Clock,
    fields: ['close_of_escrow_days', 'requested_close_date', 'inspection_contingency_present', 'inspection_contingency_days', 'appraisal_contingency_present', 'appraisal_contingency_days', 'loan_contingency_present', 'loan_contingency_days'],
  },
  {
    title: 'Terms & Requests',
    icon: AlertTriangle,
    fields: ['leaseback_requested', 'leaseback_days', 'seller_credit_requested', 'repairs_requested', 'occupancy_terms', 'special_requests'],
  },
  {
    title: 'Documentation',
    icon: Shield,
    fields: ['proof_of_funds_present', 'proof_of_income_present', 'preapproval_present', 'lender_name', 'addenda_present', 'disclosure_acknowledgment_present'],
  },
];

// --------------- component ---------------

export default function OfferIntake() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sample offers from existing data shown as "already extracted"
  const [expandedOffer, setExpandedOffer] = useState(sampleProperty.offers[0].id);
  const [reviewResults, setReviewResults] = useState<Record<string, any>>({});
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);

  // New upload state
  const [packages, setPackages] = useState<OfferPackage[]>([]);
  const [activePackageId, setActivePackageId] = useState<string | null>(null);
  const [showNewUpload, setShowNewUpload] = useState(false);
  const [newOfferName, setNewOfferName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocCategory>('Purchase Agreement');
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);

  // View toggle
  const [view, setView] = useState<'existing' | 'upload'>('existing');

  const createPackage = () => {
    if (!newOfferName.trim()) {
      toast({ title: 'Enter an offer name', description: 'e.g. "Whitfield Trust" or "Buyer 6"', variant: 'destructive' });
      return;
    }
    const pkg: OfferPackage = {
      id: `pkg-${Date.now()}`,
      name: newOfferName.trim(),
      documents: [],
      extraction: null,
      status: 'idle',
    };
    setPackages(prev => [...prev, pkg]);
    setActivePackageId(pkg.id);
    setNewOfferName('');
    setShowNewUpload(false);

    // Create offer in DB in background
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({ title: 'Not signed in', description: 'Please sign in to upload documents.', variant: 'destructive' });
          return;
        }
        const dealId = await getOrCreateDemoAnalysis(user.id);
        const offerId = await createOffer(user.id, dealId, pkg.name);
        setPackages(prev => prev.map(p =>
          p.id === pkg.id ? { ...p, dbOfferId: offerId } : p
        ));
      } catch (e: any) {
        console.error('Failed to create offer in DB:', e);
        toast({ title: 'Could not create offer', description: e?.message ?? 'Please try again.', variant: 'destructive' });
      }
    })();
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || !activePackageId) return;
    const newDocs: UploadedDoc[] = Array.from(files).map(f => ({
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file: f,
      category: selectedCategory,
      status: 'uploading' as const,
      progress: 0,
    }));

    setPackages(prev => prev.map(p =>
      p.id === activePackageId ? { ...p, documents: [...p.documents, ...newDocs] } : p
    ));

    // Upload files — wait for offer to exist, then upload
    const currentPkgId = activePackageId;
    newDocs.forEach(doc => {
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('You must be signed in to upload documents.');
          }

          // Wait up to ~10s for the background offer creation to finish
          let dbOfferId: string | undefined;
          for (let i = 0; i < 50; i++) {
            const latest = await new Promise<OfferPackage | undefined>(resolve => {
              setPackages(prev => {
                resolve(prev.find(p => p.id === currentPkgId));
                return prev;
              });
            });
            if (latest?.dbOfferId) { dbOfferId = latest.dbOfferId; break; }
            await new Promise(r => setTimeout(r, 200));
          }
          if (!dbOfferId) {
            throw new Error('Offer is still being created — please try again in a moment.');
          }

          setPackages(prev => prev.map(p =>
            p.id === currentPkgId
              ? { ...p, documents: p.documents.map(d => d.id === doc.id ? { ...d, progress: 30 } : d) }
              : p
          ));

          const { documentId } = await uploadDocument(user.id, dbOfferId, doc.file, doc.category);

          setPackages(prev => prev.map(p =>
            p.id === currentPkgId
              ? { ...p, documents: p.documents.map(d => d.id === doc.id ? { ...d, status: 'complete', progress: 100, dbDocId: documentId } : d) }
              : p
          ));
        } catch (e: any) {
          console.error('Upload failed:', e);
          setPackages(prev => prev.map(p =>
            p.id === currentPkgId
              ? { ...p, documents: p.documents.map(d => d.id === doc.id ? { ...d, status: 'error', progress: 0 } : d) }
              : p
          ));
          toast({
            title: 'Upload failed',
            description: e?.message ?? 'Could not upload the document.',
            variant: 'destructive',
          });
        }
      })();
    });
  }, [activePackageId, selectedCategory, toast]);
  const removeDoc = (pkgId: string, docId: string) => {
    setPackages(prev => prev.map(p =>
      p.id === pkgId ? { ...p, documents: p.documents.filter(d => d.id !== docId) } : p
    ));
  };

  const runExtraction = async (pkgId: string) => {
    const pkg = packages.find(p => p.id === pkgId);
    if (!pkg) return;

    setPackages(prev => prev.map(p =>
      p.id === pkgId ? { ...p, status: 'extracting' } : p
    ));

    try {
      // Try real backend extraction
      if (pkg.dbOfferId) {
        const docPayload = pkg.documents.map(d => ({
          id: d.dbDocId || d.id,
          name: d.file.name,
          category: d.category,
        }));

        const result = await triggerExtraction(pkg.dbOfferId, pkg.name, docPayload);

        // Convert result to ExtractionResult format for display
        const extraction: ExtractionResult = {};
        if (result.extraction) {
          for (const field of result.extraction) {
            extraction[field.field_name] = {
              value: field.field_value,
              confidence: field.confidence,
              evidence: field.evidence,
            };
          }
        }

        setPackages(prev => prev.map(p =>
          p.id === pkgId ? { ...p, status: 'complete', extraction, dbExtractionResult: result } : p
        ));
        toast({
          title: 'Extraction complete',
          description: `${result.fields_count} fields extracted (v${result.version}). Completeness: ${result.completeness}`,
        });
        return;
      }
    } catch (e: any) {
      console.error('Real extraction failed, falling back to mock:', e);
    }

    // Fallback: simulate with mock data
    setTimeout(() => {
      setPackages(prev => prev.map(p =>
        p.id === pkgId ? { ...p, status: 'complete', extraction: MOCK_EXTRACTION } : p
      ));
      toast({ title: 'Extraction complete', description: 'All fields have been extracted and scored.' });
    }, 2500);
  };

  const activePkg = packages.find(p => p.id === activePackageId);

  const runPackageReview = async (offerId: string) => {
    const offer = sampleProperty.offers.find(o => o.id === offerId);
    if (!offer) return;
    setReviewLoading(offerId);
    try {
      const offerPayload = {
        buyer: offer.buyerName,
        agent: offer.agentName,
        brokerage: offer.agentBrokerage,
        price: offer.offerPrice,
        financing: offer.financingType,
        down_payment: offer.downPayment,
        down_payment_pct: offer.downPaymentPercent,
        earnest_money: offer.earnestMoney,
        contingencies: offer.contingencies,
        inspection_period: offer.inspectionPeriod,
        appraisal_terms: offer.appraisalTerms,
        close_days: offer.closeDays,
        close_timeline: offer.closeTimeline,
        leaseback: offer.leasebackRequest,
        concessions: offer.concessions,
        proof_of_funds: offer.proofOfFunds,
        pre_approval: offer.preApproval,
        completeness: offer.completeness,
        special_notes: offer.specialNotes,
        scores: offer.scores,
      };
      const docsPayload = offer.documents.map(d => ({
        name: d.name,
        category: d.category,
        status: d.status,
        confidence: d.confidence,
      }));

      const response = await fetch(`${SUPABASE_URL}/functions/v1/review-package`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(SUPABASE_KEY ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
        },
        body: JSON.stringify({
          offer: offerPayload,
          documents: docsPayload,
          property: { address: sampleProperty.address, listingPrice: sampleProperty.listingPrice },
        }),
      });

      const data = await response.json();
      if (!response.ok || data?.error) {
        toast({ title: 'Review Error', description: data?.error || 'Request failed', variant: 'destructive' });
      } else if (data?.analysis) {
        setReviewResults(prev => ({ ...prev, [offerId]: data.analysis }));
      }
    } catch (e: any) {
      toast({ title: 'Review Failed', description: e.message || 'Something went wrong', variant: 'destructive' });
    } finally {
      setReviewLoading(null);
    }
  };

  // Compute summary stats for extraction
  const getExtractionStats = (ext: ExtractionResult) => {
    const fields = Object.values(ext);
    const found = fields.filter(f => f.value !== null).length;
    const highConf = fields.filter(f => f.confidence >= 0.9).length;
    const lowConf = fields.filter(f => f.confidence > 0 && f.confidence < 0.7).length;
    const avgConf = fields.filter(f => f.confidence > 0).reduce((s, f) => s + f.confidence, 0) / (fields.filter(f => f.confidence > 0).length || 1);
    return { total: fields.length, found, highConf, lowConf, avgConf };
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Intake</p>
            <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Offer Extraction</h1>
            <p className="text-[13px] text-muted-foreground font-body mt-2">
              Upload offer packages. AI extracts and scores every deal term automatically.
            </p>
          </div>
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
            <button
              onClick={() => setView('existing')}
              className={`px-3 py-1.5 text-xs font-body font-medium rounded-md transition-colors ${view === 'existing' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Extracted ({sampleProperty.offers.length})
            </button>
            <button
              onClick={() => setView('upload')}
              className={`px-3 py-1.5 text-xs font-body font-medium rounded-md transition-colors ${view === 'upload' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Upload New
            </button>
          </div>
        </div>

        {/* ========= EXISTING OFFERS VIEW ========= */}
        {view === 'existing' && (
          <>
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
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        <span className="text-xs font-medium font-body text-success">{offer.completeness}%</span>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border p-5 space-y-6">
                      {/* Documents */}
                      <div>
                        <h4 className="text-xs font-semibold font-body uppercase tracking-wider text-muted-foreground mb-3">Documents</h4>
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
                        <h4 className="text-xs font-semibold font-body uppercase tracking-wider text-muted-foreground mb-3">Extracted Deal Terms</h4>
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

                      {/* AI Package Review */}
                      <div className="border-t border-border pt-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4 text-accent" strokeWidth={1.5} />
                            <h4 className="text-xs font-semibold font-body uppercase tracking-wider text-muted-foreground">AI Package Review</h4>
                          </div>
                          <button
                            onClick={() => runPackageReview(offer.id)}
                            disabled={reviewLoading === offer.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-[11px] font-body font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                          >
                            {reviewLoading === offer.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            {reviewLoading === offer.id ? 'Reviewing…' : reviewResults[offer.id] ? 'Re-review' : 'Review Package'}
                          </button>
                        </div>

                        {reviewResults[offer.id] && (() => {
                          const review = reviewResults[offer.id];
                          const scoreColor = review.submission_confidence_score >= 80 ? 'text-success' : review.submission_confidence_score >= 60 ? 'text-warning' : 'text-destructive';
                          const scoreBg = review.submission_confidence_score >= 80 ? 'bg-success' : review.submission_confidence_score >= 60 ? 'bg-warning' : 'bg-destructive';
                          return (
                            <div className="space-y-4">
                              {/* Score + Summary */}
                              <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
                                <div className="text-center flex-shrink-0">
                                  <p className={`text-3xl font-display font-semibold ${scoreColor}`}>{review.submission_confidence_score}</p>
                                  <p className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-body mt-0.5">Confidence</p>
                                  <div className="w-12 h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                                    <div className={`h-full rounded-full ${scoreBg}`} style={{ width: `${review.submission_confidence_score}%` }} />
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <p className="text-[12px] text-muted-foreground font-body leading-relaxed">{review.overall_summary}</p>
                                </div>
                              </div>

                              <div className="grid sm:grid-cols-2 gap-3">
                                {/* Missing Items */}
                                {review.missing_items?.length > 0 && (
                                  <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/[0.03]">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <AlertOctagon className="w-3.5 h-3.5 text-destructive" strokeWidth={1.5} />
                                      <p className="text-[10px] tracking-[0.12em] uppercase text-destructive font-body font-medium">Missing Items</p>
                                    </div>
                                    <div className="space-y-2">
                                      {review.missing_items.map((m: any, i: number) => (
                                        <div key={i}>
                                          <div className="flex items-center gap-1.5">
                                            <p className="text-[12px] font-body font-medium text-foreground">{m.item}</p>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-body font-medium ${m.urgency === 'critical' ? 'bg-destructive/10 text-destructive' : m.urgency === 'important' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}>{m.urgency}</span>
                                          </div>
                                          <p className="text-[11px] text-muted-foreground font-body">{m.impact}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Weak Points */}
                                {review.weak_points?.length > 0 && (
                                  <div className="p-3 rounded-lg border border-warning/20 bg-warning/[0.03]">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <AlertTriangle className="w-3.5 h-3.5 text-warning" strokeWidth={1.5} />
                                      <p className="text-[10px] tracking-[0.12em] uppercase text-warning font-body font-medium">Weak Points</p>
                                    </div>
                                    <div className="space-y-2">
                                      {review.weak_points.map((w: any, i: number) => (
                                        <div key={i}>
                                          <p className="text-[12px] font-body font-medium text-foreground">{w.issue}</p>
                                          <p className="text-[11px] text-muted-foreground font-body">{w.why_it_matters}</p>
                                          <p className="text-[11px] text-accent font-body mt-0.5">→ {w.fix}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Strengths */}
                                {review.strengths?.length > 0 && (
                                  <div className="p-3 rounded-lg border border-success/20 bg-success/[0.03]">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <Shield className="w-3.5 h-3.5 text-success" strokeWidth={1.5} />
                                      <p className="text-[10px] tracking-[0.12em] uppercase text-success font-body font-medium">Strengths</p>
                                    </div>
                                    <ul className="space-y-1">
                                      {review.strengths.map((s: string, i: number) => (
                                        <li key={i} className="text-[11px] font-body text-foreground leading-relaxed">• {s}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Stale Items */}
                                {review.stale_items?.length > 0 && (
                                  <div className="p-3 rounded-lg border border-border bg-muted/30">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <Clock className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                                      <p className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground font-body font-medium">Stale / Outdated</p>
                                    </div>
                                    <div className="space-y-1.5">
                                      {review.stale_items.map((s: any, i: number) => (
                                        <div key={i}>
                                          <p className="text-[12px] font-body font-medium text-foreground">{s.item}</p>
                                          <p className="text-[11px] text-muted-foreground font-body">{s.detail}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Recommended Improvements */}
                              {review.recommended_improvements?.length > 0 && (
                                <div>
                                  <p className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground font-body font-medium mb-2">Recommended Improvements</p>
                                  <div className="space-y-1.5">
                                    {review.recommended_improvements.map((r: any, i: number) => (
                                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-md border border-border/40">
                                        <Target className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${r.priority === 'high' ? 'text-accent' : r.priority === 'medium' ? 'text-info' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                                        <div>
                                          <div className="flex items-center gap-1.5">
                                            <p className="text-[12px] font-body font-medium text-foreground">{r.action}</p>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-body font-medium ${r.priority === 'high' ? 'bg-accent/10 text-accent' : r.priority === 'medium' ? 'bg-info/10 text-info' : 'bg-muted text-muted-foreground'}`}>{r.priority}</span>
                                          </div>
                                          <p className="text-[11px] text-muted-foreground font-body">{r.reasoning}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ========= UPLOAD NEW VIEW ========= */}
        {view === 'upload' && (
          <div className="space-y-6">
            {/* Offer package list */}
            <div className="flex gap-3 flex-wrap items-center">
              {packages.map(pkg => (
                <button
                  key={pkg.id}
                  onClick={() => setActivePackageId(pkg.id)}
                  className={`px-4 py-2 rounded-lg border text-sm font-body font-medium transition-all ${
                    activePackageId === pkg.id
                      ? 'border-accent bg-accent/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-accent/40'
                  }`}
                >
                  <span>{pkg.name}</span>
                  {pkg.status === 'complete' && <CheckCircle className="w-3.5 h-3.5 inline ml-2 text-success" />}
                  {pkg.status === 'extracting' && <Sparkles className="w-3.5 h-3.5 inline ml-2 text-accent animate-pulse" />}
                  <span className="ml-2 text-xs text-muted-foreground">{pkg.documents.length} docs</span>
                </button>
              ))}

              {!showNewUpload ? (
                <button
                  onClick={() => setShowNewUpload(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-border text-sm font-body text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Offer Package
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newOfferName}
                    onChange={e => setNewOfferName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createPackage()}
                    placeholder="Buyer name or label…"
                    className="px-3 py-2 rounded-lg border border-border bg-card text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    autoFocus
                  />
                  <button onClick={createPackage} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-body font-medium hover:opacity-90 transition-opacity">
                    Create
                  </button>
                  <button onClick={() => setShowNewUpload(false)} className="p-2 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Active package detail */}
            {activePkg ? (
              <div className="space-y-6">
                {/* Upload zone */}
                <div className="card-elevated p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold font-body">{activePkg.name}</h3>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value as DocCategory)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-body focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Drop zone */}
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/40 transition-colors cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={e => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files); }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => handleFiles(e.target.files)}
                    />
                    <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground group-hover:text-accent transition-colors" />
                    <p className="text-sm font-body text-muted-foreground">
                      Drop PDF or DOCX files here, or <span className="text-accent font-medium">browse</span>
                    </p>
                    <p className="text-xs font-body text-muted-foreground/60 mt-1">
                      Category: {selectedCategory}
                    </p>
                  </div>

                  {/* Uploaded docs list */}
                  {activePkg.documents.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {activePkg.documents.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-body truncate">{doc.file.name}</p>
                            <p className="text-xs text-muted-foreground font-body">{doc.category}</p>
                          </div>
                          {doc.status === 'uploading' && (
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${doc.progress}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground font-body">{doc.progress}%</span>
                            </div>
                          )}
                          {doc.status === 'complete' && <CheckCircle className="w-4 h-4 text-success" />}
                          {doc.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
                          <button onClick={() => removeDoc(activePkg.id, doc.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extract button */}
                  {activePkg.documents.length > 0 && activePkg.status !== 'complete' && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => runExtraction(activePkg.id)}
                        disabled={activePkg.status === 'extracting' || activePkg.documents.some(d => d.status === 'uploading')}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-body font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {activePkg.status === 'extracting' ? (
                          <>
                            <Sparkles className="w-4 h-4 animate-pulse" />
                            Extracting…
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Run AI Extraction
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Extraction Results */}
                {activePkg.extraction && (
                  <div className="space-y-6">
                    {/* Summary bar */}
                    {(() => {
                      const stats = getExtractionStats(activePkg.extraction!);
                      return (
                        <div className="card-elevated p-5">
                          <div className="flex items-center gap-3 mb-4">
                            <Sparkles className="w-5 h-5 text-accent" />
                            <h3 className="text-base font-semibold font-body">Extraction Summary</h3>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground font-body">Fields Found</p>
                              <p className="text-2xl font-semibold font-display">{stats.found}<span className="text-sm text-muted-foreground font-body">/{stats.total}</span></p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-body">High Confidence</p>
                              <p className="text-2xl font-semibold font-display text-success">{stats.highConf}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-body">Needs Review</p>
                              <p className="text-2xl font-semibold font-display text-warning">{stats.lowConf}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-body">Avg. Confidence</p>
                              <p className="text-2xl font-semibold font-display">{Math.round(stats.avgConf * 100)}%</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Notable items */}
                    {(() => {
                      const ext = activePkg.extraction!;
                      const risks = ext.notable_risks?.value as string[] | null;
                      const strengths = ext.notable_strengths?.value as string[] | null;
                      const missing = ext.missing_items?.value as string[] | null;
                      if (!risks?.length && !strengths?.length && !missing?.length) return null;
                      return (
                        <div className="grid sm:grid-cols-3 gap-4">
                          {strengths && strengths.length > 0 && (
                            <div className="p-4 rounded-lg border border-success/20 bg-success/5">
                              <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-success" />
                                <h4 className="text-xs font-semibold font-body uppercase tracking-wider text-success">Strengths</h4>
                              </div>
                              <ul className="space-y-1.5">
                                {strengths.map((s, i) => (
                                  <li key={i} className="text-xs font-body text-foreground leading-relaxed">{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {risks && risks.length > 0 && (
                            <div className="p-4 rounded-lg border border-warning/20 bg-warning/5">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-warning" />
                                <h4 className="text-xs font-semibold font-body uppercase tracking-wider text-warning">Risks</h4>
                              </div>
                              <ul className="space-y-1.5">
                                {risks.map((r, i) => (
                                  <li key={i} className="text-xs font-body text-foreground leading-relaxed">{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {missing && missing.length > 0 && (
                            <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="w-4 h-4 text-destructive" />
                                <h4 className="text-xs font-semibold font-body uppercase tracking-wider text-destructive">Missing</h4>
                              </div>
                              <ul className="space-y-1.5">
                                {missing.map((m, i) => (
                                  <li key={i} className="text-xs font-body text-foreground leading-relaxed">{m}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Field groups */}
                    {FIELD_GROUPS.map(group => {
                      const Icon = group.icon;
                      return (
                        <div key={group.title} className="card-elevated p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <h4 className="text-xs font-semibold font-body uppercase tracking-wider text-muted-foreground">{group.title}</h4>
                          </div>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {group.fields.map(key => {
                              const field = activePkg.extraction![key];
                              if (!field) return null;
                              const isExpEv = expandedEvidence === key;
                              return (
                                <div key={key} className={`p-3 rounded-lg border transition-all ${confidenceBg(field.confidence)}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-muted-foreground font-body">{fieldLabel(key)}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-xs font-medium font-body ${confidenceColor(field.confidence)}`}>
                                        {field.confidence > 0 ? `${Math.round(field.confidence * 100)}%` : '—'}
                                      </span>
                                      {field.evidence && (
                                        <button
                                          onClick={() => setExpandedEvidence(isExpEv ? null : key)}
                                          className="p-0.5 text-muted-foreground hover:text-accent transition-colors"
                                          title="View evidence"
                                        >
                                          <Eye className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-sm font-medium font-body">{formatValue(field.value)}</p>
                                  {isExpEv && field.evidence && (
                                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-body text-muted-foreground italic leading-relaxed">
                                      <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
                                      "{field.evidence}"
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Empty state */
              <div className="card-elevated p-12 text-center">
                <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold font-body mb-1">No offer packages yet</h3>
                <p className="text-sm text-muted-foreground font-body mb-4">
                  Create an offer package to start uploading documents and extracting deal terms.
                </p>
                <button
                  onClick={() => setShowNewUpload(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-body font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  Create First Package
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}