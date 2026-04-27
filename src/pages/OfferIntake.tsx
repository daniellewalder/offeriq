import AppLayout from '@/components/AppLayout';
import { formatCurrency } from '@/data/sampleData';
import {
  CheckCircle, AlertCircle, Clock, FileText, Upload,
  Plus, Shield, Eye, AlertTriangle, Sparkles, X, Info, Loader2, ArrowRight
} from 'lucide-react';
import { useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  resolveActiveAnalysisId,
  touchDealAnalysis,
  createOffer,
  uploadDocument,
  triggerExtraction,
} from '@/lib/offerService';

// --------------- types ---------------

const DOC_CATEGORIES = [
  'Purchase Agreement',
  'Seller Counter',
  'Buyer Counter',
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
  status: 'queued' | 'uploading' | 'stored' | 'extracting' | 'complete' | 'error';
  progress: number;
  dbDocId?: string;
  errorMessage?: string;
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
  dbDealAnalysisId?: string;
  dbExtractionResult?: any;
  extractionError?: string;
}

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
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New upload state
  const [packages, setPackages] = useState<OfferPackage[]>([]);
  const [activePackageId, setActivePackageId] = useState<string | null>(null);
  const [showNewUpload, setShowNewUpload] = useState(false);
  const [newOfferName, setNewOfferName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocCategory>('Purchase Agreement');
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);

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
        const dealId = await resolveActiveAnalysisId(user.id);
        const offerId = await createOffer(user.id, dealId, pkg.name);
        setPackages(prev => prev.map(p =>
          p.id === pkg.id ? { ...p, dbOfferId: offerId, dbDealAnalysisId: dealId } : p
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
              ? { ...p, documents: p.documents.map(d => d.id === doc.id ? { ...d, status: 'stored', progress: 100, dbDocId: documentId, errorMessage: undefined } : d) }
              : p
          ));
        } catch (e: any) {
          console.error('Upload failed:', e);
          const errMsg = e?.message ?? 'Could not upload the document.';
          setPackages(prev => prev.map(p =>
            p.id === currentPkgId
              ? { ...p, documents: p.documents.map(d => d.id === doc.id ? { ...d, status: 'error', progress: 0, errorMessage: errMsg } : d) }
              : p
          ));
          toast({
            title: 'Upload failed',
            description: errMsg,
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

    if (!pkg.dbOfferId) {
      toast({
        title: 'Offer not ready',
        description: 'Wait a moment for the offer record to finish creating, then try again.',
        variant: 'destructive',
      });
      return;
    }
    const unstored = pkg.documents.filter(d => d.status !== 'stored' && d.status !== 'complete');
    if (unstored.length > 0) {
      toast({
        title: 'Documents still uploading',
        description: 'Wait for all documents to finish uploading before extracting.',
        variant: 'destructive',
      });
      return;
    }

    setPackages(prev => prev.map(p =>
      p.id === pkgId ? { ...p, status: 'extracting', extractionError: undefined, documents: p.documents.map(d => ({ ...d, status: 'extracting' as const })) } : p
    ));

    try {
      const docPayload = pkg.documents.map(d => ({
        id: d.dbDocId || d.id,
        name: d.file.name,
        category: d.category,
      }));

      const result = await triggerExtraction(pkg.dbOfferId, pkg.name, docPayload);

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
        p.id === pkgId
          ? {
              ...p,
              status: 'complete',
              extraction,
              dbExtractionResult: result,
              documents: p.documents.map(d => ({ ...d, status: 'complete' as const })),
            }
          : p
      ));
      toast({
        title: 'Extraction complete',
        description: `${result.fields_count ?? Object.keys(extraction).length} fields extracted (v${result.version ?? 1}). Opening comparison…`,
      });

      // Make sure Comparison's "latest analysis" picks the one this offer belongs to
      if (pkg.dbDealAnalysisId) {
        try { await touchDealAnalysis(pkg.dbDealAnalysisId); } catch {}
      }

      // Navigate so the agent sees their real offer alongside the rest
      setTimeout(() => navigate('/comparison'), 1200);
    } catch (e: any) {
      const msg = e?.message ?? 'Extraction failed. Check that your PDFs contain selectable text.';
      console.error('Extraction failed:', e);
      setPackages(prev => prev.map(p =>
        p.id === pkgId
          ? {
              ...p,
              status: 'idle',
              extractionError: msg,
              documents: p.documents.map(d => ({ ...d, status: d.dbDocId ? 'stored' as const : d.status })),
            }
          : p
      ));
      toast({ title: 'Extraction failed', description: msg, variant: 'destructive' });
    }
  };

  const activePkg = packages.find(p => p.id === activePackageId);

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
          <Link
            to="/comparison"
            className="inline-flex items-center gap-1.5 text-[12px] font-body font-medium px-3 py-2 rounded-sm border border-border/60 text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors"
          >
            View comparison <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Link>
        </div>

        {/* ========= UPLOAD ========= */}
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
                        <div key={doc.id} className={`flex items-start gap-3 p-3 border rounded-lg ${doc.status === 'error' ? 'border-destructive/40 bg-destructive/5' : 'border-border'}`}>
                          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-body truncate">{doc.file.name}</p>
                            <p className="text-xs text-muted-foreground font-body">
                              {doc.category}
                              {' · '}
                              <span className={
                                doc.status === 'error' ? 'text-destructive' :
                                doc.status === 'complete' ? 'text-success' :
                                doc.status === 'stored' ? 'text-success' :
                                doc.status === 'extracting' ? 'text-accent' :
                                'text-muted-foreground'
                              }>
                                {doc.status === 'queued' && 'Queued'}
                                {doc.status === 'uploading' && 'Uploading'}
                                {doc.status === 'stored' && 'Stored ✓'}
                                {doc.status === 'extracting' && 'Extracting…'}
                                {doc.status === 'complete' && 'Done ✓'}
                                {doc.status === 'error' && 'Error'}
                              </span>
                            </p>
                            {doc.errorMessage && (
                              <p className="text-[11px] text-destructive font-body mt-1">{doc.errorMessage}</p>
                            )}
                          </div>
                          {doc.status === 'uploading' && (
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${doc.progress}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground font-body">{doc.progress}%</span>
                            </div>
                          )}
                          {doc.status === 'stored' && <CheckCircle className="w-4 h-4 text-success" />}
                          {doc.status === 'extracting' && <Sparkles className="w-4 h-4 text-accent animate-pulse" />}
                          {doc.status === 'complete' && <CheckCircle className="w-4 h-4 text-success" />}
                          {doc.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
                          <button onClick={() => removeDoc(activePkg.id, doc.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Package-level extraction error */}
                  {activePkg.extractionError && (
                    <div className="mt-4 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-[12px] font-body text-destructive">
                      <span className="font-medium">Extraction error: </span>{activePkg.extractionError}
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
      </div>
    </AppLayout>
  );
}