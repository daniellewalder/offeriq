import { useState, useCallback, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  extractOffersFromPDFs,
  validatePDFFiles,
  type ExtractionProgressCallback,
} from "../lib/offerExtraction";
import {
  computeDealCertaintyScore,
  getRiskLevel,
  formatDollars,
  type OfferFile,
  type ExtractionResult,
} from "../types/offer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OfferUploaderProps {
  /** Called when all files have been processed */
  onComplete?: (offers: OfferFile[]) => void;
  /** Max number of PDFs per upload session */
  maxFiles?: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskBadge({ score }: { score: number }) {
  const level = getRiskLevel(score);
  const config = {
    low: { label: "Low risk", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    medium: { label: "Medium risk", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    high: { label: "High risk", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  }[level];

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${config.className}`}>
      {config.label}
    </span>
  );
}

function ConfidenceDot({ level }: { level: "high" | "medium" | "low" }) {
  const colors = { high: "bg-emerald-400", medium: "bg-amber-400", low: "bg-red-400" };
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400">
      <span className={`w-1.5 h-1.5 rounded-full ${colors[level]}`} />
      {level} confidence
    </span>
  );
}

function ExtractionSummary({ offer }: { offer: OfferFile }) {
  const [expanded, setExpanded] = useState(false);

  if (!offer.extracted) return null;

  const { extracted } = offer;
  const score = computeDealCertaintyScore(extracted);
  const p = extracted.price;
  const c = extracted.contingencies;
  const f = extracted.financing;

  const contingencyList = [
    c.inspection && `Inspection (${c.inspection_days ?? "?"}d)`,
    c.appraisal && !c.appraisal_waived && `Appraisal (${c.appraisal_days ?? "?"}d)`,
    c.loan && `Loan (${c.loan_days ?? "?"}d)`,
    c.sale_of_property && "Sale of property",
  ].filter(Boolean) as string[];

  return (
    <div className="mt-3 rounded-lg border border-slate-700/60 overflow-hidden bg-slate-800/40">
      {/* Summary row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Offer price</p>
            <p className="text-sm font-semibold text-white">{formatDollars(p.offer_price)}</p>
          </div>
          <div className="w-px h-8 bg-slate-700" />
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Finance</p>
            <p className="text-sm font-medium text-slate-200">
              {f.is_cash_offer ? "All cash" : (p.finance_type?.toUpperCase() ?? "—")}
            </p>
          </div>
          <div className="w-px h-8 bg-slate-700" />
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Close</p>
            <p className="text-sm font-medium text-slate-200">
              {extracted.timeline.close_of_escrow_days
                ? `${extracted.timeline.close_of_escrow_days}d`
                : "—"}
            </p>
          </div>
          <div className="w-px h-8 bg-slate-700" />
          <div className="flex flex-col gap-1">
            <RiskBadge score={score} />
            <ConfidenceDot level={extracted.document_meta.confidence} />
          </div>
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {expanded ? "Less" : "More"}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-700/60 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
          <Detail label="Buyer" value={extracted.buyer.name} />
          <Detail label="Buyer agent" value={extracted.buyer.agent_name} />
          <Detail label="Initial deposit" value={formatDollars(p.initial_deposit)} />
          <Detail label="Down payment" value={formatDollars(p.down_payment)} />
          <Detail label="Loan amount" value={formatDollars(p.loan_amount)} />
          <Detail label="Seller credits" value={formatDollars(extracted.credits_and_costs.seller_credits)} />
          <Detail label="Contingencies" value={contingencyList.length > 0 ? contingencyList.join(", ") : "None"} />
          <Detail label="Leaseback" value={c.sale_of_property ? "Requested" : "No"} />
          {extracted.risk_flags.has_escalation_clause && (
            <Detail
              label="Escalation"
              value={`Up to ${formatDollars(extracted.risk_flags.escalation_cap)}`}
              highlight
            />
          )}
          {extracted.document_meta.missing_fields.length > 0 && (
            <div className="col-span-2">
              <p className="text-slate-500 mb-1">Fields not found in document:</p>
              <p className="text-amber-400/80">
                {extracted.document_meta.missing_fields.join(", ")}
              </p>
            </div>
          )}
          {extracted.document_meta.extraction_notes && (
            <div className="col-span-2">
              <p className="text-slate-500 mb-1">Notes</p>
              <p className="text-slate-300">{extracted.document_meta.extraction_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className={`font-medium ${highlight ? "text-amber-400" : "text-slate-200"}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}

// ─── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: OfferFile["status"] }) {
  if (status === "extracting") return <Loader2 size={16} className="text-blue-400 animate-spin" />;
  if (status === "complete") return <CheckCircle size={16} className="text-emerald-400" />;
  if (status === "error") return <AlertCircle size={16} className="text-red-400" />;
  return <FileText size={16} className="text-slate-500" />;
}

// ─── File row ─────────────────────────────────────────────────────────────────

function FileRow({ offer, onRemove }: { offer: OfferFile; onRemove: (id: string) => void }) {
  const sizeKB = (offer.file_size / 1024).toFixed(0);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 shrink-0">
            <StatusIcon status={offer.status} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">{offer.file_name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {sizeKB} KB
              {offer.status === "extracting" && (
                <span className="ml-2 text-blue-400">Extracting with Claude…</span>
              )}
              {offer.status === "error" && (
                <span className="ml-2 text-red-400">{offer.error}</span>
              )}
            </p>
          </div>
        </div>

        {offer.status !== "extracting" && (
          <button
            onClick={() => onRemove(offer.id)}
            className="shrink-0 text-slate-600 hover:text-slate-300 transition-colors p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <ExtractionSummary offer={offer} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OfferUploader({ onComplete, maxFiles = 20 }: OfferUploaderProps) {
  const [offers, setOffers] = useState<OfferFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateOfferStatus: ExtractionProgressCallback = useCallback(
    (fileId, status, result?: ExtractionResult, error?: string) => {
      setOffers((prev) =>
        prev.map((o) =>
          o.id === fileId
            ? {
                ...o,
                status,
                extracted: result?.extracted ?? o.extracted,
                error: error ?? o.error,
              }
            : o
        )
      );
    },
    []
  );

  const processFiles = useCallback(
    async (rawFiles: File[]) => {
      setValidationErrors([]);
      const { valid, errors } = validatePDFFiles(rawFiles);

      if (errors.length > 0) {
        setValidationErrors(errors.map((e) => e.reason));
      }

      if (valid.length === 0) return;

      // Enforce max
      const toProcess = valid.slice(0, maxFiles - offers.length);
      if (toProcess.length < valid.length) {
        setValidationErrors((prev) => [
          ...prev,
          `Only ${toProcess.length} of ${valid.length} files were added (max ${maxFiles} total).`,
        ]);
      }

      // Create pending offer entries immediately so the UI updates
      const pendingOffers: OfferFile[] = toProcess.map((file) => ({
        id: crypto.randomUUID(),
        file_name: file.name,
        file_size: file.size,
        status: "pending",
        extracted: null,
        uploaded_at: new Date().toISOString(),
      }));

      setOffers((prev) => [...prev, ...pendingOffers]);
      setIsProcessing(true);

      // Map our pre-created IDs onto the files so progress callbacks match
      const idMap = new Map<string, string>(); // fileName -> id
      pendingOffers.forEach((o) => idMap.set(o.file_name, o.id));

      // We override progress so we can use our pre-assigned IDs
      const progressWithIds: ExtractionProgressCallback = (_, status, result, error) => {
        // find matching pending offer by file_name from result
        const fileName = result?.file_name ?? "";
        const mappedId = idMap.get(fileName);
        if (mappedId) updateOfferStatus(mappedId, status, result, error);
      };

      try {
        const completed = await extractOffersFromPDFs(toProcess, progressWithIds);
        // Sync final state cleanly
        setOffers((prev) =>
          prev.map((o) => {
            const match = completed.find((c) => c.file_name === o.file_name && o.status !== "complete");
            return match
              ? { ...o, status: match.status, extracted: match.extracted, error: match.error }
              : o;
          })
        );
        if (onComplete) {
          setOffers((current) => {
            onComplete(current);
            return current;
          });
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [offers.length, maxFiles, updateOfferStatus, onComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    [processFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      processFiles(files);
      // Reset input so same file can be re-added after removal
      e.target.value = "";
    },
    [processFiles]
  );

  const removeOffer = useCallback((id: string) => {
    setOffers((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const completedCount = offers.filter((o) => o.status === "complete").length;
  const canAddMore = offers.length < maxFiles && !isProcessing;

  return (
    <div className="w-full space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => canAddMore && inputRef.current?.click()}
        className={`
          relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
          ${isDragging
            ? "border-blue-400 bg-blue-500/5 scale-[1.005]"
            : "border-slate-700 hover:border-slate-500 bg-slate-900/40 hover:bg-slate-800/40"
          }
          ${!canAddMore ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileInput}
          disabled={!canAddMore}
        />
        <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center transition-colors
            ${isDragging ? "bg-blue-500/20" : "bg-slate-800"}
          `}>
            <Upload
              size={22}
              className={isDragging ? "text-blue-400" : "text-slate-400"}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">
              {isDragging ? "Drop PDFs here" : "Drop offer PDFs or click to browse"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              RPA, counter-offers, addenda, pre-approvals · PDF only · max 20MB each
            </p>
          </div>
          {offers.length > 0 && (
            <p className="text-xs text-slate-600">
              {offers.length} / {maxFiles} files added
            </p>
          )}
        </div>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 space-y-1">
          {validationErrors.map((err, i) => (
            <p key={i} className="text-xs text-red-400 flex items-center gap-2">
              <AlertCircle size={12} className="shrink-0" />
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Progress header */}
      {offers.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {isProcessing
              ? `Extracting offers… ${completedCount} / ${offers.length} done`
              : `${completedCount} offer${completedCount !== 1 ? "s" : ""} extracted`}
          </p>
          {!isProcessing && offers.length > 0 && (
            <button
              onClick={() => setOffers([])}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* File list */}
      {offers.length > 0 && (
        <div className="space-y-2">
          {offers.map((offer) => (
            <FileRow key={offer.id} offer={offer} onRemove={removeOffer} />
          ))}
        </div>
      )}

      {/* Proceed CTA */}
      {completedCount > 0 && !isProcessing && (
        <button
          onClick={() => onComplete?.(offers)}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700
            text-sm font-semibold text-white transition-colors"
        >
          Run analysis on {completedCount} offer{completedCount !== 1 ? "s" : ""} →
        </button>
      )}
    </div>
  );
}

export default OfferUploader;
