import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Printer,
  PlayCircle,
  Check,
  AlertCircle,
  X,
} from "lucide-react";
import {
  fetchPortalMeta,
  unlockPortal,
  type PortalPayload,
} from "@/lib/portalService";
import {
  formatCurrencySeller as fmt,
  type SellerOfferCard,
  type SellerPresentation,
} from "@/lib/sellerReportBuilder";

/**
 * Private, password-gated seller experience.
 * Layered UX — overview first, then deeper details on tap.
 */
export default function SellerPortal() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(true);
  const [title, setTitle] = useState("Seller Portal");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [payload, setPayload] = useState<PortalPayload | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const meta = await fetchPortalMeta(token);
        if (!active) return;
        setNeedsCode(!!meta.requires_code);
        setTitle(meta.title || "Seller Portal");
      } catch (e: any) {
        setErr(e.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const unlock = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const p = await unlockPortal(token, code);
      setPayload(p);
      setNeedsCode(false);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!payload) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="card-paper p-10 max-w-md w-full text-center">
          <Lock className="w-5 h-5 text-accent mx-auto mb-4" />
          <p className="eyebrow-plain mb-3">Private Seller Portal</p>
          <h1 className="heading-display text-3xl mb-3">{title}</h1>
          <p className="text-[13.5px] text-muted-foreground font-body mb-7">
            Enter the access code your agent shared. This page is private to
            you.
          </p>
          <form onSubmit={unlock} className="space-y-4">
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Access code"
              className="w-full px-4 py-3.5 rounded-md border border-border-strong bg-card text-center tracking-[0.3em] text-[16px] uppercase focus-ring"
            />
            {err && (
              <p className="text-[12px] text-destructive font-body">{err}</p>
            )}
            <button
              type="submit"
              disabled={loading || code.length < 3}
              className="btn-primary w-full justify-center disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" /> Enter portal
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <PortalShell
      presentation={payload.presentation}
      onPresent={() => navigate(`/portal/${token}/present`)}
      onPrint={() => window.open(`/seller-report/${token}`, "_blank")}
    />
  );
}

function PortalShell({
  presentation,
  onPresent,
  onPrint,
}: {
  presentation: SellerPresentation;
  onPresent: () => void;
  onPrint: () => void;
}) {
  const p = presentation;
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "compare">("overview");
  const open = useMemo(
    () => p.cards.find((c) => c.offer.id === openId) ?? null,
    [openId, p.cards],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/70 bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <div>
            <p className="eyebrow-plain">Offer Review</p>
            <h1 className="heading-display text-xl mt-0.5">
              {p.property.address}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onPrint} className="btn-secondary">
              <Printer className="w-3.5 h-3.5" /> PDF
            </button>
            <button onClick={onPresent} className="btn-primary">
              <PlayCircle className="w-3.5 h-3.5" /> Present
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 lg:px-10 py-12 space-y-14">
        {/* Overview hero */}
        <section>
          <p className="eyebrow mb-4">Welcome</p>
          <h2 className="heading-display text-4xl lg:text-5xl tracking-editorial leading-[1.1] max-w-3xl">
            You have <span className="text-accent">{p.overview.total_offers}</span>{" "}
            offers on the table.
          </h2>
          <p className="font-body text-[15px] text-foreground/75 mt-5 max-w-2xl leading-[1.7]">
            {p.executive_summary}
          </p>
        </section>

        {/* Top picks */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <PickTile
            kicker="Top recommendation"
            buyer={p.overview.top_recommendation.buyer}
            price={p.overview.top_recommendation.price}
            accent
          />
          <PickTile
            kicker="Highest offer"
            buyer={p.overview.highest.buyer}
            price={p.overview.highest.price}
          />
          <PickTile
            kicker="Safest offer"
            buyer={p.overview.safest.buyer}
            price={p.overview.safest.price}
          />
          <PickTile
            kicker="Best balance"
            buyer={p.overview.best_balance.buyer}
            price={p.overview.best_balance.price}
          />
        </section>

        {/* Tabs */}
        <section>
          <div className="flex items-center gap-6 border-b border-border/70 mb-8">
            <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>
              Offer cards
            </TabBtn>
            <TabBtn active={tab === "compare"} onClick={() => setTab("compare")}>
              Side-by-side
            </TabBtn>
          </div>

          {tab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {p.cards.map((c) => (
                <OfferCard
                  key={c.offer.id}
                  card={c}
                  onOpen={() => setOpenId(c.offer.id)}
                />
              ))}
            </div>
          )}

          {tab === "compare" && <ComparisonTable presentation={p} />}
        </section>

        {/* Tradeoffs */}
        <section>
          <p className="eyebrow mb-4">What you're choosing between</p>
          <h3 className="heading-display text-3xl mb-8 tracking-editorial max-w-2xl">
            The honest tradeoffs.
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {p.tradeoffs.map((t, i) => (
              <div key={i} className="card-paper p-6">
                <h4 className="heading-display text-lg mb-3">{t.title}</h4>
                <p className="font-body text-[13.5px] leading-[1.7] text-foreground/75">
                  {t.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom line */}
        <section className="card-feature p-10 lg:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-gold opacity-[0.05] rounded-full blur-3xl" />
          <div className="flex items-center gap-2 mb-5 relative">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <p className="eyebrow-plain text-accent">In plain English</p>
          </div>
          <p className="heading-display text-2xl lg:text-3xl italic leading-[1.3] max-w-3xl tracking-editorial">
            {p.bottom_line_for_seller}
          </p>
        </section>

        <footer className="text-center pt-6 pb-12">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-body">
            OfferIQ · Private Seller Portal
          </p>
        </footer>
      </main>

      {/* Drawer */}
      {open && (
        <OfferDetailDrawer card={open} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative pb-3 text-[13px] font-body tracking-wide transition-colors ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {active && (
        <span className="absolute -bottom-px left-0 right-0 h-px bg-accent" />
      )}
    </button>
  );
}

function PickTile({
  kicker,
  buyer,
  price,
  accent,
}: {
  kicker: string;
  buyer: string;
  price: number;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "card-feature p-6" : "card-paper p-6"}>
      <p className="eyebrow-plain mb-3">{kicker}</p>
      <p className="heading-display text-lg mb-1">{buyer}</p>
      <p className="score-numeral mt-2">{fmt(price)}</p>
    </div>
  );
}

function OfferCard({
  card,
  onOpen,
}: {
  card: SellerOfferCard;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="card-elevated text-left p-6 group hover:border-accent/40 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="eyebrow-plain mb-1.5">Offer from</p>
          <h3 className="heading-display text-xl">{card.offer.buyerName}</h3>
        </div>
        <div className="flex flex-col gap-1 items-end">
          {card.labels.slice(0, 2).map((l) => (
            <span key={l} className="badge-gold">
              {l}
            </span>
          ))}
        </div>
      </div>
      <p className="font-body text-[12.5px] text-muted-foreground tracking-wide mb-4">
        {card.headline}
      </p>
      <p className="font-body text-[13.5px] leading-[1.7] text-foreground/80 mb-5">
        {card.what_this_means}
      </p>
      <div className="flex items-center justify-between text-[12px] font-body text-muted-foreground tracking-wide pt-4 border-t border-border/60">
        <span>{card.risk_note}</span>
        <span className="flex items-center gap-1 text-accent group-hover:translate-x-0.5 transition-transform">
          See more <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}

function ComparisonTable({ presentation }: { presentation: SellerPresentation }) {
  const p = presentation;
  return (
    <div className="overflow-x-auto card-paper p-2">
      <table className="table-luxe">
        <thead>
          <tr>
            <th></th>
            {p.cards.map((c) => (
              <th key={c.offer.id}>
                {c.offer.buyerName}
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.labels.slice(0, 1).map((l) => (
                    <span key={l} className="badge-gold">
                      {l}
                    </span>
                  ))}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.comparison_rows.slice(1).map((row) => (
            <tr key={row.label}>
              <td className="label-key">{row.label}</td>
              {row.values.map((v, i) => (
                <td key={i} className="num">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OfferDetailDrawer({
  card,
  onClose,
}: {
  card: SellerOfferCard;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="w-full max-w-xl bg-card border-l border-border overflow-y-auto animate-slide-in-right">
        <div className="sticky top-0 bg-card border-b border-border px-7 py-4 flex items-center justify-between">
          <p className="eyebrow-plain">Offer detail</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-surface-2 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-7 lg:p-10 space-y-8">
          <div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {card.labels.map((l) => (
                <span key={l} className="badge-gold">
                  {l}
                </span>
              ))}
            </div>
            <h2 className="heading-display text-3xl mb-1">
              {card.offer.buyerName}
            </h2>
            <p className="text-[12.5px] font-body text-muted-foreground tracking-wide">
              {card.headline}
            </p>
          </div>

          <div className="card-paper p-5">
            <p className="eyebrow-plain mb-2">What this means for you</p>
            <p className="font-body text-[14px] leading-[1.7] text-foreground/85">
              {card.what_this_means}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Stat label="Offer price" value={fmt(card.offer.offerPrice)} />
            <Stat
              label="Down payment"
              value={
                (card.offer.financingType || "").toLowerCase().includes("cash")
                  ? "All cash"
                  : `${card.offer.downPaymentPercent}%`
              }
            />
            <Stat label="Earnest money" value={fmt(card.offer.earnestMoney)} />
            <Stat
              label="Close timeline"
              value={`${card.offer.closeDays || 30} days`}
            />
            <Stat
              label="Contingencies"
              value={
                card.offer.contingencies.length === 0
                  ? "None"
                  : card.offer.contingencies.length.toString()
              }
            />
            <Stat
              label="Likelihood to close"
              value={`${card.scores?.closeProbability.score ?? 75}%`}
            />
          </div>

          <div>
            <p className="eyebrow mb-3">What's working</p>
            <ul className="space-y-2.5">
              {card.pros.map((pp, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-[13.5px] font-body text-foreground/80 leading-[1.6]"
                >
                  <Check className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                  <span>{pp}</span>
                </li>
              ))}
            </ul>
          </div>

          {card.cons.length > 0 && (
            <div>
              <p className="eyebrow mb-3">Worth knowing</p>
              <ul className="space-y-2.5">
                {card.cons.map((cc, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-[13.5px] font-body text-foreground/80 leading-[1.6]"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                    <span>{cc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card-paper p-5">
            <p className="eyebrow-plain mb-2">Risk note</p>
            <p className="font-body text-[13.5px] italic text-foreground/80 leading-[1.6]">
              {card.risk_note}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-key mb-1">{label}</p>
      <p className="font-body text-[15px] tabular-nums text-foreground">{value}</p>
    </div>
  );
}