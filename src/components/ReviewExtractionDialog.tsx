import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { saveFieldCorrections, type FieldCorrection } from "@/lib/offerService";
import { useToast } from "@/hooks/use-toast";

export interface ExtractedFieldFromAI {
  field_name: string;
  field_value: any;
  confidence: number;
  evidence: string | null;
  source_document_name: string | null;
}

export interface ReviewItem {
  offerId: string;
  offerName: string;
  fields: ExtractedFieldFromAI[];
}

interface Props {
  open: boolean;
  queue: ReviewItem[];
  onClose: () => void;
  onAllReviewed: () => void;
}

/** Threshold below which a field is shown with a "low confidence" warning. */
const LOW_CONFIDENCE = 0.7;

/** Friendly labels + input types for the editable fields. */
const FIELD_META: Record<
  string,
  { label: string; type: "text" | "number" | "boolean"; suffix?: string }
> = {
  buyer_name: { label: "Buyer name", type: "text" },
  agent_name: { label: "Buyer's agent", type: "text" },
  agent_brokerage: { label: "Brokerage", type: "text" },
  offer_price: { label: "Offer price", type: "number", suffix: "$" },
  financing_type: { label: "Financing type", type: "text" },
  loan_amount: { label: "Loan amount", type: "number", suffix: "$" },
  down_payment_amount: { label: "Down payment", type: "number", suffix: "$" },
  down_payment_percent: { label: "Down payment %", type: "number", suffix: "%" },
  earnest_money_deposit: { label: "Earnest money", type: "number", suffix: "$" },
  close_of_escrow_days: { label: "Close of escrow (days)", type: "number" },
  inspection_contingency_present: { label: "Inspection contingency present", type: "boolean" },
  inspection_contingency_days: { label: "Inspection period (days)", type: "number" },
  appraisal_contingency_present: { label: "Appraisal contingency present", type: "boolean" },
  appraisal_contingency_days: { label: "Appraisal contingency (days)", type: "number" },
  loan_contingency_present: { label: "Loan contingency present", type: "boolean" },
  loan_contingency_days: { label: "Loan contingency (days)", type: "number" },
  leaseback_requested: { label: "Leaseback requested", type: "boolean" },
  leaseback_days: { label: "Leaseback (days)", type: "number" },
  concessions_requested: { label: "Concessions requested", type: "text" },
  proof_of_funds_present: { label: "Proof of funds present", type: "boolean" },
  preapproval_present: { label: "Pre-approval present", type: "boolean" },
  special_notes: { label: "Special notes", type: "text" },
};

function metaFor(name: string) {
  return (
    FIELD_META[name] ?? { label: name.replace(/_/g, " "), type: "text" as const }
  );
}

function formatVal(v: any, type: "text" | "number" | "boolean"): string {
  if (v === null || v === undefined) return "";
  if (type === "boolean") return v ? "true" : "false";
  return String(v);
}

function parseVal(raw: string, type: "text" | "number" | "boolean"): any {
  if (raw === "" || raw === null) return null;
  if (type === "number") {
    const n = Number(raw.replace(/[$,\s%]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (type === "boolean") return raw === "true";
  return raw;
}

export default function ReviewExtractionDialog({
  open,
  queue,
  onClose,
  onAllReviewed,
}: Props) {
  const { toast } = useToast();
  const [index, setIndex] = useState(0);
  // Per-field draft values, keyed by field_name
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const current = queue[index];

  // Reset drafts when the current item changes
  useEffect(() => {
    if (!current) return;
    const d: Record<string, string> = {};
    for (const f of current.fields) {
      const meta = metaFor(f.field_name);
      d[f.field_name] = formatVal(f.field_value, meta.type);
    }
    setDrafts(d);
    setEdited({});
  }, [current?.offerId]);

  const lowConfidenceFields = useMemo(
    () => (current?.fields ?? []).filter((f) => f.confidence < LOW_CONFIDENCE),
    [current],
  );
  const highConfidenceFields = useMemo(
    () => (current?.fields ?? []).filter((f) => f.confidence >= LOW_CONFIDENCE),
    [current],
  );

  if (!current) return null;

  const handleSaveAndAdvance = async () => {
    setSaving(true);
    try {
      const corrections: FieldCorrection[] = current.fields.map((f) => {
        const meta = metaFor(f.field_name);
        const draft = drafts[f.field_name] ?? "";
        const newValue = parseVal(draft, meta.type);
        const wasEdited = !!edited[f.field_name];
        return {
          field_name: f.field_name,
          field_value: wasEdited ? newValue : f.field_value,
          prior_confidence: f.confidence,
          prior_evidence: f.evidence,
          prior_source_document_name: f.source_document_name,
          prior_source_document_id: null,
          edited: wasEdited,
        };
      });
      await saveFieldCorrections(current.offerId, current.offerName, corrections);
      const editedCount = corrections.filter((c) => c.edited).length;
      toast({
        title: editedCount > 0 ? `Saved ${editedCount} correction${editedCount === 1 ? "" : "s"}` : "Confirmed extraction",
        description: `${current.offerName} updated.`,
      });
      if (index + 1 < queue.length) {
        setIndex(index + 1);
      } else {
        onAllReviewed();
      }
    } catch (e: any) {
      console.error("save corrections failed", e);
      toast({
        title: "Could not save",
        description: e?.message ?? "Try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (index + 1 < queue.length) setIndex(index + 1);
    else onAllReviewed();
  };

  const renderField = (f: ExtractedFieldFromAI) => {
    const meta = metaFor(f.field_name);
    const isLow = f.confidence < LOW_CONFIDENCE;
    const draft = drafts[f.field_name] ?? "";
    const setDraft = (v: string) => {
      setDrafts((prev) => ({ ...prev, [f.field_name]: v }));
      setEdited((prev) => ({ ...prev, [f.field_name]: true }));
    };
    return (
      <div
        key={f.field_name}
        className={`p-3 rounded-md border ${
          isLow ? "border-yellow-400/60 bg-yellow-50/40 dark:bg-yellow-950/20" : "border-border bg-card"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <Label className="text-[12px] font-medium">{meta.label}</Label>
          <div className="flex items-center gap-1.5">
            {isLow ? (
              <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400 gap-1">
                <AlertTriangle className="w-3 h-3" />
                Low confidence · {(f.confidence * 100).toFixed(0)}%
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400 gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {(f.confidence * 100).toFixed(0)}%
              </Badge>
            )}
          </div>
        </div>

        {meta.type === "boolean" ? (
          <select
            value={draft || "false"}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={meta.suffix ? `${meta.suffix === "$" ? "$" : ""}…${meta.suffix === "%" ? "%" : ""}` : "—"}
            type={meta.type === "number" ? "text" : "text"}
            inputMode={meta.type === "number" ? "decimal" : "text"}
          />
        )}

        {(f.evidence || f.source_document_name) && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              {f.source_document_name && (
                <p className="truncate font-medium text-foreground/70">{f.source_document_name}</p>
              )}
              {f.evidence && (
                <p className="italic line-clamp-2">"{f.evidence}"</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Review extracted fields
            <Badge variant="secondary" className="text-[10px]">
              {index + 1} of {queue.length}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{current.offerName}</span> has{" "}
            {lowConfidenceFields.length} field{lowConfidenceFields.length === 1 ? "" : "s"} below 70% confidence.
            Review them before scoring runs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {lowConfidenceFields.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                Needs your attention
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {lowConfidenceFields.map(renderField)}
              </div>
            </div>
          )}

          {highConfidenceFields.length > 0 && (
            <details className="rounded-md border border-border">
              <summary className="cursor-pointer px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground">
                Show {highConfidenceFields.length} confident field{highConfidenceFields.length === 1 ? "" : "s"}
              </summary>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {highConfidenceFields.map(renderField)}
              </div>
            </details>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleSkip} disabled={saving}>
            Skip
          </Button>
          <Button onClick={handleSaveAndAdvance} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : index + 1 < queue.length ? (
              "Save & next"
            ) : (
              "Save & finish"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}