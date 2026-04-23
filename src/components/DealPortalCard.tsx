import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Share2,
  ExternalLink,
  Trash2,
  ChevronRight,
  FileText,
  Loader2,
  CircleDot,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  type DealCard,
  formatRelative,
  formatDateShort,
} from "@/lib/dealsDashboardService";
import {
  createSharedPortal,
  revokePortal,
} from "@/lib/portalService";

interface Props {
  deal: DealCard;
  userId: string;
  onChanged: () => void;
}

const statusBadge = {
  not_shared: {
    label: "Not shared",
    cls: "bg-muted text-muted-foreground border-border/60",
    dot: "text-muted-foreground/60",
  },
  shared: {
    label: "Shared",
    cls: "bg-info/10 text-info border-info/30",
    dot: "text-info",
  },
  viewed: {
    label: "Viewed",
    cls: "bg-success/10 text-success border-success/30",
    dot: "text-success",
  },
  revoked: {
    label: "Revoked",
    cls: "bg-muted text-muted-foreground border-border/60 line-through",
    dot: "text-muted-foreground/60",
  },
} as const;

function fmtPrice(p: number | null) {
  if (!p) return null;
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(2)}M`;
  if (p >= 1_000) return `$${Math.round(p / 1_000)}K`;
  return `$${p}`;
}

export default function DealPortalCard({ deal, userId, onChanged }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"create" | "revoke" | null>(null);

  const portal = deal.portal;
  const status = portal?.status ?? "not_shared";
  const badge = statusBadge[status];

  const copyLink = async () => {
    if (!portal) return;
    await navigator.clipboard.writeText(portal.portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast({ title: "Portal link copied" });
  };

  const create = async () => {
    setBusy("create");
    try {
      await createSharedPortal({
        user_id: userId,
        deal_analysis_id: deal.analysisId,
        title: `Offer Review · ${deal.property.address}`,
      });
      toast({
        title: "Portal created",
        description: "Open the deal to copy the access code.",
      });
      onChanged();
    } catch (e: any) {
      toast({
        title: "Could not create portal",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    if (!portal) return;
    setBusy("revoke");
    try {
      await revokePortal(portal.id);
      toast({ title: "Access revoked" });
      onChanged();
    } catch (e: any) {
      toast({
        title: "Could not revoke",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const openAnalysis = () => navigate("/report");

  return (
    <div className="card-elevated p-5 group hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <button
          onClick={openAnalysis}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-[13px] font-medium text-foreground font-body truncate group-hover:text-accent transition-colors">
            {deal.property.address}
          </p>
          <p className="text-[11px] text-muted-foreground font-body mt-0.5 truncate">
            {deal.property.city ?? "—"}
            {fmtPrice(deal.property.listingPrice) && (
              <span> · {fmtPrice(deal.property.listingPrice)}</span>
            )}
            <span> · {deal.offerCount} offer{deal.offerCount === 1 ? "" : "s"}</span>
          </p>
        </button>

        <span
          className={`inline-flex items-center gap-1.5 text-[10px] tracking-wide uppercase font-body font-medium px-2 py-1 rounded-sm border ${badge.cls}`}
        >
          <CircleDot className={`w-2.5 h-2.5 ${badge.dot}`} strokeWidth={2.5} />
          {badge.label}
        </span>
      </div>

      {/* Portal status detail */}
      <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-3 gap-3 text-[11px] font-body">
        <div>
          <p className="text-muted-foreground/70 tracking-wide uppercase text-[9px] mb-1">
            Created
          </p>
          <p className="text-foreground/85">
            {formatDateShort(deal.createdAt)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground/70 tracking-wide uppercase text-[9px] mb-1">
            Shared
          </p>
          <p className="text-foreground/85">
            {portal ? formatDateShort(portal.createdAt) : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground/70 tracking-wide uppercase text-[9px] mb-1">
            Last viewed
          </p>
          <p className="text-foreground/85 flex items-center gap-1">
            {portal?.lastAccessedAt ? (
              <>
                <Eye className="w-3 h-3 text-success" strokeWidth={1.5} />
                {formatRelative(portal.lastAccessedAt)}
              </>
            ) : portal ? (
              <>
                <EyeOff className="w-3 h-3 text-muted-foreground/60" strokeWidth={1.5} />
                Not yet
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      {portal && portal.viewCount > 0 && !portal.revokedAt && (
        <p className="mt-2 text-[11px] text-muted-foreground font-body">
          {portal.viewCount} view{portal.viewCount === 1 ? "" : "s"} total · updated {formatRelative(deal.updatedAt)}
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <button
          onClick={openAnalysis}
          className="inline-flex items-center gap-1.5 text-[11px] font-body font-medium px-2.5 py-1.5 rounded-sm border border-border/60 hover:border-accent/40 hover:text-accent transition-colors"
        >
          <FileText className="w-3 h-3" strokeWidth={1.5} />
          Open analysis
        </button>

        {!portal || portal.revokedAt ? (
          <button
            onClick={create}
            disabled={busy === "create"}
            className="inline-flex items-center gap-1.5 text-[11px] font-body font-medium px-2.5 py-1.5 rounded-sm bg-accent/10 text-accent border border-accent/30 hover:bg-accent/15 transition-colors disabled:opacity-60"
          >
            {busy === "create" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Share2 className="w-3 h-3" strokeWidth={1.5} />
            )}
            {portal?.revokedAt ? "Re-share" : "Create portal"}
          </button>
        ) : (
          <>
            <Link
              to={`/portal/${portal.token}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-[11px] font-body font-medium px-2.5 py-1.5 rounded-sm border border-border/60 hover:border-accent/40 hover:text-accent transition-colors"
            >
              <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
              Open portal
            </Link>
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 text-[11px] font-body font-medium px-2.5 py-1.5 rounded-sm border border-border/60 hover:border-accent/40 hover:text-accent transition-colors"
            >
              {copied ? (
                <Check className="w-3 h-3 text-success" strokeWidth={2} />
              ) : (
                <Copy className="w-3 h-3" strokeWidth={1.5} />
              )}
              Copy link
            </button>
            <button
              onClick={revoke}
              disabled={busy === "revoke"}
              className="inline-flex items-center gap-1.5 text-[11px] font-body font-medium px-2.5 py-1.5 rounded-sm border border-border/60 text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-colors disabled:opacity-60 ml-auto"
              title="Revoke seller access"
            >
              {busy === "revoke" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
              )}
              Revoke
            </button>
          </>
        )}
      </div>
    </div>
  );
}