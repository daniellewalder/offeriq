import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Printer, ShieldCheck, Lock } from "lucide-react";
import {
  fetchPortalMeta,
  unlockPortal,
  type PortalPayload,
} from "@/lib/portalService";
import {
  formatCurrencySeller as fmt,
  type SellerPresentation,
  type SellerOfferCard,
} from "@/lib/sellerReportBuilder";

/**
 * Print-friendly seller report. Designed for "Print → Save as PDF".
 * Looks like a luxury client document — large serif type, heavy whitespace,
 * obvious section breaks.
 */
export default function SellerReportPDF() {
  const { token = "" } = useParams<{ token: string }>();
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(true);
  const [title, setTitle] = useState("Seller Report");
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
        setTitle(meta.title || "Seller Report");
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
        <div className="card-paper p-8 lg:p-10 max-w-sm w-full text-center">
          <Lock className="w-5 h-5 text-accent mx-auto mb-4" />
          <p className="eyebrow-plain mb-2">Private Document</p>
          <h1 className="heading-display text-2xl mb-2">{title}</h1>
          <p className="text-[13px] text-muted-foreground font-body mb-6">
            Enter the access code your agent shared with you.
          </p>
          <form onSubmit={unlock} className="space-y-3">
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Access code"
              className="w-full px-4 py-3 rounded-md border border-border-strong bg-card text-center tracking-[0.3em] text-[15px] uppercase focus-ring"
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
                  <ShieldCheck className="w-3.5 h-3.5" /> View report
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <ReportDocument presentation={payload.presentation} />;
}

function ReportDocument({ presentation }: { presentation: SellerPresentation }) {
  const p = presentation;
  const prepared = new Date(p.property.prepared_on).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background pdf-doc">
      {/* Floating Print button (no-print) */}
      <button
        onClick={() => window.print()}
        className="btn-primary no-print fixed top-6 right-6 z-50 shadow-md"
      >
        <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
      </button>

      {/* COVER */}
      <section className="pdf-page flex flex-col justify-between p-16 lg:p-24">
        <div>
          <p className="eyebrow-plain mb-4">Offer Review · Prepared for the seller</p>
          <div className="rule-hairline w-32 mb-10" />
          <h1 className="heading-display text-5xl lg:text-6xl leading-[1.05] tracking-editorial max-w-3xl">
            {p.property.address}
          </h1>
          {p.property.city && (
            <p className="font-body text-[14px] text-muted-foreground mt-3 tracking-wide">
              {p.property.city}
            </p>
          )}
          <div className="mt-12 grid grid-cols-3 gap-8 max-w-2xl">
            <div>
              <p className="label-key">Listing</p>
              <p className="score-numeral mt-2">{fmt(p.property.listing_price)}</p>
            </div>
            <div>
              <p className="label-key">Offers</p>
              <p className="score-numeral mt-2">{p.overview.total_offers}</p>
            </div>
            <div>
              <p className="label-key">Highest</p>
              <p className="score-numeral mt-2">{fmt(p.overview.highest.price)}</p>
            </div>
          </div>
        </div>
        <div>
          <div className="rule-hairline w-full mb-6" />
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow-plain">Recommendation Report</p>
              <p className="heading-display text-2xl mt-2">
                {p.overview.top_recommendation.buyer}
              </p>
              <p className="text-[12px] text-muted-foreground font-body mt-1">
                Top recommendation · {fmt(p.overview.top_recommendation.price)}
              </p>
            </div>
            <div className="text-right">
              <p className="label-key">Prepared</p>
              <p className="font-body text-[13px] mt-1">{prepared}</p>
            </div>
          </div>
        </div>
      </section>

      {/* EXECUTIVE SUMMARY */}
      <section className="pdf-page p-16 lg:p-24">
        <p className="eyebrow mb-6">Executive Summary</p>
        <h2 className="heading-display text-3xl lg:text-4xl mb-8 max-w-3xl tracking-editorial">
          What you're looking at, in plain English.
        </h2>
        <p className="font-body text-[15.5px] leading-[1.8] text-foreground/80 max-w-3xl">
          {p.executive_summary}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <PicksTile label="Highest offer" buyer={p.overview.highest.buyer} price={p.overview.highest.price} />
          <PicksTile label="Safest offer" buyer={p.overview.safest.buyer} price={p.overview.safest.price} highlight />
          <PicksTile label="Best balance" buyer={p.overview.best_balance.buyer} price={p.overview.best_balance.price} />
        </div>

        <div className="rule-hairline mt-12 mb-8" />
        <p className="eyebrow mb-4">Your priorities, ranked</p>
        <div className="flex flex-wrap gap-2">
          {p.priority_summary.slice(0, 5).map((it) => (
            <span key={it.label} className="badge-neutral">
              {it.label} · {it.weight}
            </span>
          ))}
        </div>
      </section>

      {/* HEADLINE RECOMMENDATION */}
      <section className="pdf-page p-16 lg:p-24">
        <p className="eyebrow mb-6">The recommendation</p>
        <h2 className="heading-display text-4xl lg:text-5xl mb-8 max-w-3xl tracking-editorial">
          {p.report.best_overall.headline}
        </h2>
        <p className="font-body text-[15.5px] leading-[1.8] text-foreground/80 max-w-3xl">
          {p.report.best_overall.explanation}
        </p>
        {p.report.best_overall.proof_points.length > 0 && (
          <>
            <div className="rule-hairline my-10 max-w-3xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 max-w-3xl">
              {p.report.best_overall.proof_points.map((pp, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 text-[13px] font-body text-foreground/80"
                >
                  <span className="w-1 h-1 rounded-full bg-accent mt-2 shrink-0" />
                  <span>{pp}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* TRADEOFFS */}
      <section className="pdf-page p-16 lg:p-24">
        <p className="eyebrow mb-6">Key tradeoffs</p>
        <h2 className="heading-display text-3xl lg:text-4xl mb-10 max-w-3xl tracking-editorial">
          What you're trading off, and why it matters.
        </h2>
        <div className="space-y-8 max-w-3xl">
          {p.tradeoffs.map((t, i) => (
            <div key={i}>
              <h3 className="heading-display text-xl mb-2">{t.title}</h3>
              <p className="font-body text-[14.5px] leading-[1.7] text-foreground/80">
                {t.body}
              </p>
              {i < p.tradeoffs.length - 1 && <div className="rule-hairline mt-8" />}
            </div>
          ))}
        </div>
      </section>

      {/* COMPARISON */}
      <section className="pdf-page p-16 lg:p-24">
        <p className="eyebrow mb-6">Side-by-side comparison</p>
        <h2 className="heading-display text-3xl lg:text-4xl mb-10 tracking-editorial">
          Every offer, every term.
        </h2>
        <div className="overflow-x-auto">
          <table className="table-luxe">
            <thead>
              <tr>
                <th></th>
                {p.cards.map((c) => (
                  <th key={c.offer.id}>
                    {c.offer.buyerName}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.labels.slice(0, 2).map((l) => (
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
                    <td key={i} className="num">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* RISK NOTES */}
      <section className="pdf-page p-16 lg:p-24">
        <p className="eyebrow mb-6">Risk notes by offer</p>
        <h2 className="heading-display text-3xl lg:text-4xl mb-10 tracking-editorial">
          What to watch with each buyer.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {p.cards.map((c) => (
            <RiskTile key={c.offer.id} card={c} />
          ))}
        </div>
      </section>

      {/* NEGOTIATION PATH */}
      <section className="pdf-page p-16 lg:p-24">
        <p className="eyebrow mb-6">Suggested negotiation path</p>
        <h2 className="heading-display text-3xl lg:text-4xl mb-10 tracking-editorial">
          How we'd play this hand.
        </h2>
        <ol className="space-y-7 max-w-3xl">
          {p.report.negotiation_path.map((step) => (
            <li key={step.order} className="flex gap-5">
              <span className="score-numeral text-accent w-10 shrink-0">
                {step.order}
              </span>
              <div>
                <h3 className="heading-display text-xl mb-1">{step.headline}</h3>
                <p className="font-body text-[14px] leading-[1.7] text-foreground/80">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {p.report.suggested_counter && (
          <div className="card-feature p-8 mt-12 max-w-3xl">
            <p className="eyebrow mb-3">Counter strategy</p>
            <h3 className="heading-display text-2xl mb-3">
              {p.report.suggested_counter.title}
            </h3>
            <p className="font-body text-[14.5px] leading-[1.7] text-foreground/80 mb-4">
              {p.report.suggested_counter.rationale}
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="badge-gold">
                Counter at {fmt(p.report.suggested_counter.counter_price)}
              </span>
              <span className="badge-neutral">
                {p.report.suggested_counter.acceptance_likelihood}% acceptance
              </span>
              <span className="badge-neutral">
                Target · {p.report.suggested_counter.target_buyer}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* BOTTOM LINE */}
      <section className="pdf-page p-16 lg:p-24 flex flex-col justify-center">
        <p className="eyebrow mb-6">Bottom line</p>
        <p className="heading-display text-3xl lg:text-[2.5rem] leading-[1.2] max-w-3xl italic text-foreground tracking-editorial">
          “{p.bottom_line_for_seller}”
        </p>
        <div className="rule-hairline mt-14 max-w-3xl" />
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-body mt-4">
          OfferIQ · Prepared {prepared}
        </p>
      </section>
    </div>
  );
}

function PicksTile({
  label,
  buyer,
  price,
  highlight,
}: {
  label: string;
  buyer: string;
  price: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "card-feature p-6"
          : "card-paper p-6"
      }
    >
      <p className="eyebrow-plain mb-3">{label}</p>
      <p className="heading-display text-xl mb-1">{buyer}</p>
      <p className="score-numeral mt-3">{fmt(price)}</p>
    </div>
  );
}

function RiskTile({ card }: { card: SellerOfferCard }) {
  return (
    <div className="card-paper p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="heading-display text-lg">{card.offer.buyerName}</h3>
        <div className="flex gap-1 flex-wrap justify-end">
          {card.labels.slice(0, 2).map((l) => (
            <span key={l} className="badge-gold">
              {l}
            </span>
          ))}
        </div>
      </div>
      <p className="font-body text-[13.5px] leading-[1.65] text-foreground/80 mb-4">
        {card.what_this_means}
      </p>
      <div className="rule-hairline mb-4" />
      <p className="label-key mb-2">What to watch</p>
      <p className="font-body text-[13px] text-foreground/70 italic">
        {card.risk_note}
      </p>
    </div>
  );
}