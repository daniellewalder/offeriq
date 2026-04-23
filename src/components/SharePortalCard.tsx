import { useEffect, useState } from "react";
import {
  Share2,
  Lock,
  Copy,
  Check,
  Loader2,
  PlayCircle,
  FileDown,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  createSharedPortal,
  listPortalsForAnalysis,
  revokePortal,
  type CreatedPortal,
} from "@/lib/portalService";
import { supabase } from "@/integrations/supabase/client";
import { fetchLatestAnalysisForUser } from "@/lib/offerService";

/**
 * Share controls for the agent: generates a private seller portal link
 * + access code for the latest deal analysis.
 */
export default function SharePortalCard({
  propertyAddress,
}: {
  propertyAddress: string;
}) {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedPortal | null>(null);
  const [existing, setExisting] = useState<any[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        if (!active) return;
        setUserId(user.id);
        const analysis = await fetchLatestAnalysisForUser(user.id);
        if (!analysis) return;
        setAnalysisId(analysis.id);
        const list = await listPortalsForAnalysis(user.id, analysis.id);
        if (active) setExisting(list);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const create = async () => {
    if (!userId || !analysisId) {
      toast({
        title: "Sign in required",
        description:
          "Sharing the portal requires a signed-in agent account with a deal analysis.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      const portal = await createSharedPortal({
        user_id: userId,
        deal_analysis_id: analysisId,
        title: `Offer Review · ${propertyAddress}`,
      });
      setCreated(portal);
      const list = await listPortalsForAnalysis(userId, analysisId);
      setExisting(list);
      toast({
        title: "Portal ready",
        description: "Share the link and code with your seller.",
      });
    } catch (e: any) {
      toast({
        title: "Could not create portal",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  };

  const revoke = async (id: string) => {
    await revokePortal(id);
    if (userId && analysisId) {
      const list = await listPortalsForAnalysis(userId, analysisId);
      setExisting(list);
    }
    toast({ title: "Portal revoked" });
  };

  return (
    <div className="card-paper p-7 lg:p-8 no-print">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <p className="eyebrow mb-3">Share with your seller</p>
          <h3 className="heading-display text-2xl mb-2">
            A private, password-protected portal.
          </h3>
          <p className="font-body text-[13.5px] text-muted-foreground leading-[1.7] max-w-xl">
            Generate a link your seller can open from anywhere. Includes the
            full review, a downloadable PDF, and a guided presentation mode for
            your live meeting.
          </p>
        </div>
        {!created && (
          <button
            onClick={create}
            disabled={creating || loading}
            className="btn-gold disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" /> Generate seller link
              </>
            )}
          </button>
        )}
      </div>

      {created && (
        <div className="mt-7 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CopyRow
            label="Portal link"
            value={created.portal_url}
            onCopy={() => copy(created.portal_url, "portal")}
            copied={copied === "portal"}
            icon={<ExternalLink className="w-3.5 h-3.5" />}
          />
          <CopyRow
            label="Access code"
            value={created.code}
            mono
            onCopy={() => copy(created.code, "code")}
            copied={copied === "code"}
            icon={<Lock className="w-3.5 h-3.5" />}
          />
          <CopyRow
            label="Seller PDF"
            value={created.pdf_url}
            onCopy={() => copy(created.pdf_url, "pdf")}
            copied={copied === "pdf"}
            icon={<FileDown className="w-3.5 h-3.5" />}
          />
          <CopyRow
            label="Presentation mode"
            value={created.presentation_url}
            onCopy={() => copy(created.presentation_url, "present")}
            copied={copied === "present"}
            icon={<PlayCircle className="w-3.5 h-3.5" />}
          />
        </div>
      )}

      {existing.length > 0 && !created && (
        <div className="mt-7">
          <p className="label-key mb-3">Existing links</p>
          <ul className="space-y-2">
            {existing.slice(0, 4).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-border/70 bg-card text-[12.5px] font-body"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Lock className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="truncate text-foreground/80">
                    {window.location.origin}/portal/{p.token}
                  </span>
                  {p.revoked_at && (
                    <span className="badge-neutral">Revoked</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      copy(`${window.location.origin}/portal/${p.token}`, p.id)
                    }
                    className="p-1.5 rounded hover:bg-surface-2"
                    title="Copy link"
                  >
                    {copied === p.id ? (
                      <Check className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                  {!p.revoked_at && (
                    <button
                      onClick={() => revoke(p.id)}
                      className="p-1.5 rounded hover:bg-surface-2"
                      title="Revoke"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
  copied,
  icon,
  mono,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  icon: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card p-4">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        {icon}
        <p className="label-key">{label}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p
          className={`text-[13px] truncate ${
            mono
              ? "font-mono tracking-[0.25em] text-foreground"
              : "font-body text-foreground/85"
          }`}
        >
          {value}
        </p>
        <button
          onClick={onCopy}
          className="shrink-0 p-1.5 rounded hover:bg-surface-2 transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-success" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}