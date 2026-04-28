import AppLayout from '@/components/AppLayout';
import {
  CheckCircle, AlertCircle, FileText, Upload, Plus, X, Sparkles,
  Loader2, ArrowRight, Wand2, Trash2, Folder, HelpCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  createOffer,
  uploadDocument,
  triggerExtraction,
  touchDealAnalysis,
} from '@/lib/offerService';
import {
  resolveActiveAnalysisId,
  fetchAnalysisById,
  fetchAnalysisSummariesForUser,
  setStoredActiveAnalysisId,
} from '@/lib/activeAnalysis';
import ReviewExtractionDialog, {
  type ReviewItem,
} from '@/components/ReviewExtractionDialog';
import {
  DOC_CATEGORIES,
  type DocCategory,
  inferCategory,
  inferBuyerKey,
  titleCaseBuyerKey,
} from '@/lib/intakeHeuristics';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StagedFile {
  id: string;
  file: File;
  category: DocCategory;
  // Which package this file is currently assigned to. `null` = unassigned (sitting in the staging tray).
  packageId: string | null;
  // Where the current packageId came from, so we can show "Auto-grouped"
  // (green) vs "Needs review" (yellow) badges in the staging tray.
  groupingSource?: 'ai' | 'filename' | 'manual' | 'none';
  groupingConfidence?: number; // 0..1, only meaningful when groupingSource === 'ai'
}

interface StagedPackage {
  id: string;
  name: string;
  // Per-package processing state during the batch run
  status: 'idle' | 'uploading' | 'extracting' | 'complete' | 'error';
  message?: string;
}

interface AnalysisSummary {
  id: string;
  label: string;
  city: string | null;
  listingPrice: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const newId = (p: string) =>
  `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// AI-confidence threshold above which an auto-grouping is shown as
// "Auto-grouped" (green). Below it, the file is still pre-grouped but
// flagged with a yellow "Needs review" badge so the agent verifies it.
const AI_CONFIDENT = 0.7;

// ─── Component ───────────────────────────────────────────────────────────────

export default function OfferIntake() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active analysis context
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisLabel, setAnalysisLabel] = useState<string>('');
  const [analysisOptions, setAnalysisOptions] = useState<AnalysisSummary[]>([]);
  const [needsPicker, setNeedsPicker] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);

  // Staging state
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [packages, setPackages] = useState<StagedPackage[]>([]);
  const [dragOverPkg, setDragOverPkg] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [grouping, setGrouping] = useState(false);
  // Files queued for the manual "Which buyer?" modal because the AI
  // could not place them confidently.
  const [manualQueue, setManualQueue] = useState<string[]>([]); // file ids
  const [manualOpen, setManualOpen] = useState(false);
  const [manualNewName, setManualNewName] = useState('');
  const [manualPkgId, setManualPkgId] = useState<string>('__new__');
  // Packages whose extraction returned at least one field below the
  // confidence threshold get queued here. The review dialog opens after
  // the batch finishes so the agent can correct them in one sweep.
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);

  // ── Boot: resolve analysis context ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setBootLoading(false); return; }

      const id = await resolveActiveAnalysisId(user.id, searchParams);
      if (!id) {
        // No analyses at all — push them to NewAnalysis instead.
        if (!cancelled) {
          setBootLoading(false);
          toast({
            title: 'Start a new analysis first',
            description: 'Create a deal so we know which property these offers belong to.',
          });
          navigate('/new-analysis');
        }
        return;
      }

      const summaries = await fetchAnalysisSummariesForUser(user.id);
      if (cancelled) return;
      setAnalysisOptions(
        summaries.map(s => ({
          id: s.id,
          label: s.properties?.address || s.name,
          city: s.properties?.city ?? null,
          listingPrice: s.properties?.listing_price ?? null,
        })),
      );

      // If no explicit ?analysis= was passed and there's >1 analysis,
      // make the user confirm which deal they're uploading into.
      const explicit = searchParams.get('analysis');
      if (!explicit && summaries.length > 1) {
        setNeedsPicker(true);
        setBootLoading(false);
        return;
      }

      const analysis = await fetchAnalysisById(user.id, id);
      if (cancelled) return;
      setAnalysisId(id);
      setAnalysisLabel(
        (analysis as any)?.properties?.address || (analysis as any)?.name || 'Active deal',
      );
      setStoredActiveAnalysisId(id);
      setBootLoading(false);
    })();
    return () => { cancelled = true; };
  }, [searchParams, toast, navigate]);

  const pickAnalysis = (id: string) => {
    setStoredActiveAnalysisId(id);
    const next = new URLSearchParams(searchParams);
    next.set('analysis', id);
    setSearchParams(next, { replace: true });
    setNeedsPicker(false);
  };

  // ── Staging actions ──
  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const list = Array.from(incoming);
    if (list.length === 0) return;
    const staged: StagedFile[] = list.map(f => ({
      id: newId('file'),
      file: f,
      category: inferCategory(f.name),
      packageId: null,
    }));
    setFiles(prev => [...prev, ...staged]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const setFileCategory = (id: string, category: DocCategory) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, category } : f));
  };

  const moveFileToPackage = (fileId: string, packageId: string | null) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, packageId } : f));
  };

  const addPackage = (name?: string) => {
    const id = newId('pkg');
    setPackages(prev => [
      ...prev,
      { id, name: name?.trim() || `Offer ${prev.length + 1}`, status: 'idle' },
    ]);
    return id;
  };

  const renamePackage = (id: string, name: string) => {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const removePackage = (id: string) => {
    setFiles(prev => prev.map(f => f.packageId === id ? { ...f, packageId: null } : f));
    setPackages(prev => prev.filter(p => p.id !== id));
  };

  const autoGroup = () => {
    if (files.length === 0) {
      toast({ title: 'Add some files first', description: 'Drop PDFs into the tray, then auto-group.' });
      return;
    }
    // Group unassigned files by inferred buyer key.
    const groups = new Map<string, StagedFile[]>();
    for (const f of files) {
      if (f.packageId !== null) continue;
      const key = inferBuyerKey(f.file.name);
      const arr = groups.get(key) ?? [];
      arr.push(f);
      groups.set(key, arr);
    }
    if (groups.size === 0) {
      toast({ title: 'Nothing to group', description: 'All files are already assigned to a package.' });
      return;
    }

    const newPackages: StagedPackage[] = [];
    const fileUpdates = new Map<string, string>(); // fileId -> packageId
    let i = packages.length;
    for (const [key, group] of groups.entries()) {
      i += 1;
      const pkg: StagedPackage = {
        id: newId('pkg'),
        name: titleCase(key) || `Offer ${i}`,
        status: 'idle',
      };
      newPackages.push(pkg);
      for (const f of group) fileUpdates.set(f.id, pkg.id);
    }

    setPackages(prev => [...prev, ...newPackages]);
    setFiles(prev => prev.map(f => fileUpdates.has(f.id) ? { ...f, packageId: fileUpdates.get(f.id)! } : f));
    toast({
      title: `Created ${newPackages.length} package${newPackages.length === 1 ? '' : 's'}`,
      description: 'Drag files between packages to fix any misgroupings.',
    });
  };

  // ── Drag & drop between packages ──
  const onDragStartFile = (e: React.DragEvent, fileId: string) => {
    e.dataTransfer.setData('text/x-file-id', fileId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDropPackage = (e: React.DragEvent, packageId: string | null) => {
    e.preventDefault();
    setDragOverPkg(null);
    const fileId = e.dataTransfer.getData('text/x-file-id');
    if (fileId) moveFileToPackage(fileId, packageId);
  };
  const allowDrop = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  // ── Process all packages ──
  const processAll = async () => {
    if (!analysisId) return;
    const ready = packages.filter(p => filesFor(p.id).length > 0);
    if (ready.length === 0) {
      toast({
        title: 'Nothing to process',
        description: 'Create a package and assign at least one file.',
        variant: 'destructive',
      });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'Not signed in', variant: 'destructive' });
      return;
    }

    setRunning(true);
    let okCount = 0;
    const collectedReviews: ReviewItem[] = [];
    for (const pkg of ready) {
      setPackages(prev => prev.map(p =>
        p.id === pkg.id ? { ...p, status: 'uploading', message: undefined } : p,
      ));
      try {
        const offerId = await createOffer(user.id, analysisId, pkg.name);
        const myFiles = filesFor(pkg.id);
        const docPayload: { id: string; name: string; category: string }[] = [];
        for (const sf of myFiles) {
          const { documentId } = await uploadDocument(user.id, offerId, sf.file, sf.category);
          docPayload.push({ id: documentId, name: sf.file.name, category: sf.category });
        }
        setPackages(prev => prev.map(p =>
          p.id === pkg.id ? { ...p, status: 'extracting' } : p,
        ));
        const result = await triggerExtraction(offerId, pkg.name, docPayload);
        // If the extractor returned per-field confidences and any of
        // them are below 0.7, queue this package for manual review.
        const fields: any[] = Array.isArray((result as any)?.fields) ? (result as any).fields : [];
        const hasLowConfidence = fields.some((f) => Number(f.confidence ?? 0) < 0.7);
        if (hasLowConfidence) {
          collectedReviews.push({
            offerId,
            offerName: pkg.name,
            fields: fields.map((f) => ({
              field_name: f.field_name,
              field_value: f.field_value,
              confidence: Number(f.confidence ?? 0),
              evidence: f.evidence ?? null,
              source_document_name: f.source_document_name ?? null,
            })),
          });
        }
        setPackages(prev => prev.map(p =>
          p.id === pkg.id ? { ...p, status: 'complete' } : p,
        ));
        okCount += 1;
      } catch (e: any) {
        const msg = e?.message ?? 'Failed';
        console.error('Package failed:', pkg.name, e);
        setPackages(prev => prev.map(p =>
          p.id === pkg.id ? { ...p, status: 'error', message: msg } : p,
        ));
      }
    }

    try { await touchDealAnalysis(analysisId); } catch { /* ignore */ }
    setRunning(false);

    if (okCount > 0) {
      // If anything needs review, open the dialog and let the user
      // walk through it before we send them off to comparison.
      if (collectedReviews.length > 0) {
        setReviewQueue(collectedReviews);
        setReviewOpen(true);
        toast({
          title: `Processed ${okCount} offer${okCount === 1 ? '' : 's'}`,
          description: `${collectedReviews.length} need${collectedReviews.length === 1 ? 's' : ''} a quick review for low-confidence fields.`,
        });
        return;
      }
      toast({
        title: `Processed ${okCount} offer${okCount === 1 ? '' : 's'}`,
        description: 'Opening comparison…',
      });
      setTimeout(() => navigate(`/comparison?analysis=${analysisId}`), 900);
    } else {
      toast({
        title: 'No packages processed',
        description: 'Check the errors and try again.',
        variant: 'destructive',
      });
    }
  };

  const handleReviewClosed = () => {
    setReviewOpen(false);
    if (analysisId) {
      setTimeout(() => navigate(`/comparison?analysis=${analysisId}`), 300);
    }
  };

  // Helpers
  const filesFor = (pkgId: string | null) => files.filter(f => f.packageId === pkgId);
  const unassigned = useMemo(() => filesFor(null), [files]);
  const totalFiles = files.length;
  const assignedFiles = files.filter(f => f.packageId !== null).length;

  // ── Render ──
  if (bootLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-[13px] font-body">Loading…</span>
        </div>
      </AppLayout>
    );
  }

  if (needsPicker) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
          <div>
            <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Intake</p>
            <h1 className="heading-display text-3xl text-foreground">Which deal are these offers for?</h1>
            <p className="text-[13px] text-muted-foreground font-body mt-2">
              Pick the listing these offer packages belong to. You can change this later from the Dashboard.
            </p>
          </div>
          <div className="card-elevated p-3 space-y-1">
            {analysisOptions.map(o => (
              <button
                key={o.id}
                onClick={() => pickAnalysis(o.id)}
                className="w-full text-left flex items-center justify-between gap-4 px-4 py-3 rounded-md hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground font-body truncate">{o.label}</p>
                  <p className="text-[11px] text-muted-foreground font-body truncate">
                    {o.city ?? 'No city set'}
                    {o.listingPrice ? ` · $${o.listingPrice.toLocaleString()}` : ''}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <div className="text-[12px] text-muted-foreground font-body">
            Need a new listing?{' '}
            <Link to="/new-analysis" className="text-accent hover:underline">Start a new analysis</Link>.
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <ReviewExtractionDialog
          open={reviewOpen}
          queue={reviewQueue}
          onClose={handleReviewClosed}
          onAllReviewed={handleReviewClosed}
        />
        {/* Header */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">Intake</p>
            <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Upload Offer Packages</h1>
            <p className="text-[13px] text-muted-foreground font-body mt-2">
              Drop every offer PDF in the tray. Auto-group by buyer, fix the groupings, then process all of them in one go.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-body">Uploading into</div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-body font-medium text-foreground">{analysisLabel}</span>
              {analysisOptions.length > 1 && (
                <button
                  onClick={() => setNeedsPicker(true)}
                  className="text-[11px] text-muted-foreground hover:text-accent transition-colors font-body underline-offset-4 hover:underline"
                >
                  change
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className="card-elevated p-6"
          onDragOver={allowDrop}
          onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        >
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/40 transition-colors cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
              className="hidden"
              onChange={e => { addFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            />
            <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground group-hover:text-accent transition-colors" />
            <p className="text-sm font-body text-muted-foreground">
              Drop all your offer PDFs here, or <span className="text-accent font-medium">browse</span>
            </p>
            <p className="text-xs font-body text-muted-foreground/60 mt-1">
              {totalFiles > 0
                ? `${totalFiles} file${totalFiles === 1 ? '' : 's'} staged · ${assignedFiles} assigned`
                : 'You can add files from multiple buyers in one shot'}
            </p>
          </div>

          {/* Toolbar */}
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={autoGroup}
                disabled={unassigned.length === 0 || running}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-[12px] font-body font-medium text-foreground hover:border-accent/40 hover:bg-accent/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Wand2 className="w-3.5 h-3.5" /> Auto-group by buyer
              </button>
              <button
                onClick={() => addPackage()}
                disabled={running}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-border text-[12px] font-body text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> New empty package
              </button>
            </div>
            <button
              onClick={processAll}
              disabled={running || packages.every(p => filesFor(p.id).length === 0)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-body font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? (
                <><Sparkles className="w-4 h-4 animate-pulse" /> Processing…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Process all packages</>
              )}
            </button>
          </div>
        </div>

        {/* Unassigned tray */}
        <PackageBin
          title={`Unassigned files (${unassigned.length})`}
          subtitle="Drag files into a package, or click Auto-group."
          tone="muted"
          isOver={dragOverPkg === '__unassigned__'}
          onDragEnter={() => setDragOverPkg('__unassigned__')}
          onDragLeave={() => setDragOverPkg(null)}
          onDrop={e => onDropPackage(e, null)}
          onDragOver={allowDrop}
        >
          {unassigned.length === 0 ? (
            <p className="text-[12px] text-muted-foreground font-body italic px-2 py-3">
              No unassigned files. Add more above or rearrange your packages.
            </p>
          ) : (
            unassigned.map(f => (
              <FileChip
                key={f.id}
                file={f}
                onCategoryChange={c => setFileCategory(f.id, c)}
                onRemove={() => removeFile(f.id)}
                onDragStart={e => onDragStartFile(e, f.id)}
                disabled={running}
              />
            ))
          )}
        </PackageBin>

        {/* Packages */}
        {packages.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <Folder className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" strokeWidth={1.5} />
            <p className="text-[13px] font-body text-foreground mb-1">No offer packages yet</p>
            <p className="text-[12px] text-muted-foreground font-body">
              Drop files above and click <span className="text-foreground font-medium">Auto-group by buyer</span>, or create a package manually.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {packages.map(pkg => {
              const pkgFiles = filesFor(pkg.id);
              return (
                <PackageBin
                  key={pkg.id}
                  title={
                    <input
                      value={pkg.name}
                      onChange={e => renamePackage(pkg.id, e.target.value)}
                      disabled={running}
                      className="bg-transparent border-none outline-none text-[13px] font-body font-medium text-foreground w-full"
                    />
                  }
                  subtitle={`${pkgFiles.length} file${pkgFiles.length === 1 ? '' : 's'}`}
                  status={pkg.status}
                  statusMessage={pkg.message}
                  onRemove={running ? undefined : () => removePackage(pkg.id)}
                  isOver={dragOverPkg === pkg.id}
                  onDragEnter={() => setDragOverPkg(pkg.id)}
                  onDragLeave={() => setDragOverPkg(null)}
                  onDrop={e => onDropPackage(e, pkg.id)}
                  onDragOver={allowDrop}
                >
                  {pkgFiles.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground font-body italic px-2 py-3">
                      Drag files here, or auto-group will fill it.
                    </p>
                  ) : (
                    pkgFiles.map(f => (
                      <FileChip
                        key={f.id}
                        file={f}
                        onCategoryChange={c => setFileCategory(f.id, c)}
                        onRemove={() => removeFile(f.id)}
                        onDragStart={e => onDragStartFile(e, f.id)}
                        disabled={running}
                      />
                    ))
                  )}
                </PackageBin>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

interface PackageBinProps {
  title: React.ReactNode;
  subtitle?: string;
  status?: StagedPackage['status'];
  statusMessage?: string;
  tone?: 'card' | 'muted';
  isOver?: boolean;
  onRemove?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  children?: React.ReactNode;
}

function PackageBin({
  title, subtitle, status, statusMessage, tone = 'card',
  isOver, onRemove, onDragOver, onDrop, onDragEnter, onDragLeave, children,
}: PackageBinProps) {
  return (
    <div
      className={`rounded-lg border transition-colors p-4 ${
        tone === 'muted' ? 'bg-muted/20 border-border/50' : 'bg-card border-border'
      } ${isOver ? 'border-accent ring-1 ring-accent/40' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">{typeof title === 'string'
            ? <p className="text-[13px] font-body font-medium text-foreground truncate">{title}</p>
            : title}
            {subtitle && <p className="text-[11px] text-muted-foreground font-body">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PackageStatusBadge status={status} message={statusMessage} />
          {onRemove && (
            <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive transition-colors" title="Remove package">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function PackageStatusBadge({ status, message }: { status?: StagedPackage['status']; message?: string }) {
  if (!status || status === 'idle') return null;
  if (status === 'uploading') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-body">
        <Loader2 className="w-3 h-3 animate-spin" /> Uploading
      </span>
    );
  }
  if (status === 'extracting') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-accent font-body">
        <Sparkles className="w-3 h-3 animate-pulse" /> Extracting
      </span>
    );
  }
  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-success font-body">
        <CheckCircle className="w-3 h-3" /> Done
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-body" title={message}>
      <AlertCircle className="w-3 h-3" /> Error
    </span>
  );
}

interface FileChipProps {
  file: StagedFile;
  onCategoryChange: (c: DocCategory) => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  disabled?: boolean;
}

function FileChip({ file, onCategoryChange, onRemove, onDragStart, disabled }: FileChipProps) {
  return (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      className={`flex items-center gap-2 p-2 border border-border rounded-md bg-background ${
        disabled ? 'opacity-60' : 'cursor-grab active:cursor-grabbing hover:border-accent/40'
      }`}
    >
      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
      <p className="flex-1 min-w-0 text-[12px] font-body text-foreground truncate" title={file.file.name}>
        {file.file.name}
      </p>
      <select
        value={file.category}
        onChange={e => onCategoryChange(e.target.value as DocCategory)}
        disabled={disabled}
        className="text-[11px] font-body bg-card border border-border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <button
        onClick={onRemove}
        disabled={disabled}
        className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
        title="Remove file"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}