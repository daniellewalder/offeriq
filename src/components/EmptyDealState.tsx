import { Link } from "react-router-dom";
import { Upload, FileText, Sparkles, ArrowRight } from "lucide-react";

interface Props {
  /** What this page would normally show. */
  title?: string;
  message?: string;
  /** Override CTA. Defaults to "Start an analysis". */
  ctaLabel?: string;
  ctaTo?: string;
  /** Secondary action (optional). */
  secondaryLabel?: string;
  secondaryTo?: string;
  /** Compact variant for inline regions. */
  compact?: boolean;
}

export default function EmptyDealState({
  title = "No live deal data yet",
  message = "Start a new analysis to upload offers and unlock the full review experience. Until then, this view will stay empty — no mock data is shown.",
  ctaLabel = "Start a new analysis",
  ctaTo = "/new-analysis",
  secondaryLabel = "Upload offers",
  secondaryTo = "/offer-intake",
  compact = false,
}: Props) {
  return (
    <div
      className={`card-elevated ${compact ? "p-6" : "p-10 lg:p-14"} text-center max-w-2xl mx-auto`}
    >
      <div
        className={`mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-5 ${
          compact ? "w-10 h-10" : "w-14 h-14"
        }`}
      >
        <Sparkles
          className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-accent`}
          strokeWidth={1.5}
        />
      </div>
      <h3
        className={`heading-display text-foreground ${
          compact ? "text-lg" : "text-2xl"
        } mb-2`}
      >
        {title}
      </h3>
      <p className="font-body text-[13px] text-muted-foreground leading-[1.7] max-w-md mx-auto">
        {message}
      </p>

      <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
        <Link
          to={ctaTo}
          className="inline-flex items-center gap-1.5 text-[12px] font-body font-medium px-4 py-2 rounded-sm bg-accent/10 text-accent border border-accent/30 hover:bg-accent/15 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
          {ctaLabel}
        </Link>
        {secondaryLabel && secondaryTo && (
          <Link
            to={secondaryTo}
            className="inline-flex items-center gap-1.5 text-[12px] font-body font-medium px-4 py-2 rounded-sm border border-border/60 text-foreground hover:border-accent/40 hover:text-accent transition-colors"
          >
            <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
            {secondaryLabel}
            <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
          </Link>
        )}
      </div>
    </div>
  );
}