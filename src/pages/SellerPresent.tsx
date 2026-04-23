import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Loader2,
  Lock,
  ShieldCheck,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  fetchPortalMeta,
  unlockPortal,
  type PortalPayload,
} from "@/lib/portalService";
import {
  formatCurrencySeller as fmt,
  type SellerPresentation,
} from "@/lib/sellerReportBuilder";

/**
 * Presentation mode: a guided, slide-style walkthrough of the deal.
 * Designed for an agent reviewing offers live with a seller.
 */
export default function SellerPresent() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [payload, setPayload] = useState<PortalPayload | null>(null);
  const [title, setTitle] = useState("Seller Presentation");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const meta = await fetchPortalMeta(token);
        if (!active) return;
        setNeedsCode(!!meta.requires_code);
        setTitle(meta.title || "Seller Presentation");
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
          <p className="eyebrow-plain mb-3">Presentation Mode</p>
          <h1 className="heading-display text-2xl mb-3">{title}</h1>
          <p className="text-[13px] text-muted-foreground font-body mb-6">
            Enter the access code to begin the presentation.
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
                  <ShieldCheck className="w-3.5 h-3.5" /> Begin
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Slides
      presentation={payload.presentation}
      onExit={() => navigate(`/portal/${token}`)}
    />
  );
}

function Slides({
  presentation,
  onExit,
}: {
  presentation: SellerPresentation;
  onExit: () => void;
}) {
  const slides = useMemo(() => buildSlides(presentation), [presentation]);
  const [i, setI] = useState(0);

  const next = useCallback(
    () => setI((x) => Math.min(x + 1, slides.length - 1)),
    [slides.length],
  );
  const prev = useCallback(() => setI((x) => Math.max(x - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onExit]);

  const slide = slides[i];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4">
        <div>
          <p className="eyebrow-plain text-muted-foreground">
            {presentation.property.address}
          </p>
        </div>
        <button
          onClick={onExit}
          className="p-2 rounded-md hover:bg-surface-2 transition-colors text-muted-foreground"
          aria-label="Exit presentation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Slide */}
      <div className="flex-1 flex items-center justify-center px-8 lg:px-20 py-20 animate-fade-in" key={i}>
        <div className="w-full max-w-5xl">{slide.body}</div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/60 bg-card/60 backdrop-blur px-6 py-4 flex items-center justify-between z-20">
        <button
          onClick={prev}
          disabled={i === 0}
          className="btn-secondary disabled:opacity-40"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-body">
          <span>{slide.label}</span>
          <span className="text-foreground/40">·</span>
          <span>
            {i + 1} / {slides.length}
          </span>
        </div>
        <button
          onClick={next}
          disabled={i === slides.length - 1}
          className="btn-primary disabled:opacity-40"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress hairline */}
      <div className="absolute bottom-[64px] left-0 right-0 h-px bg-border/40 z-10">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${((i + 1) / slides.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ── Slide composition ── */

function buildSlides(p: SellerPresentation) {
  const slides: { label: string; body: React.ReactNode }[] = [];

  // 1. Cover
  slides.push({
    label: "Cover",
    body: (
      <div>
        <p className="eyebrow mb-6">Offer Review</p>
        <h1 className="heading-display text-5xl lg:text-7xl leading-[1.05] tracking-editorial">
          {p.property.address}
        </h1>
        {p.property.city && (
          <p className="font-body text-[15px] text-muted-foreground mt-4 tracking-wide">
            {p.property.city}
          </p>
        )}
        <div className="rule-hairline w-32 mt-12 mb-10" />
        <div className="grid grid-cols-3 gap-10 max-w-2xl">
          <CoverStat label="Listing" value={fmt(p.property.listing_price)} />
          <CoverStat label="Offers" value={p.overview.total_offers.toString()} />
          <CoverStat label="Highest" value={fmt(p.overview.highest.price)} />
        </div>
      </div>
    ),
  });

  // 2. Where we are
  slides.push({
    label: "Executive Summary",
    body: (
      <div>
        <p className="eyebrow mb-6">Where we are today</p>
        <h2 className="heading-display text-4xl lg:text-5xl leading-[1.15] tracking-editorial mb-10 max-w-3xl">
          You have {p.overview.total_offers} offers in front of you.
        </h2>
        <p className="font-body text-[18px] leading-[1.7] text-foreground/80 max-w-3xl">
          {p.executive_summary}
        </p>
      </div>
    ),
  });

  // 3. The picks
  slides.push({
    label: "The picks",
    body: (
      <div>
        <p className="eyebrow mb-6">The standouts</p>
        <h2 className="heading-display text-4xl lg:text-5xl mb-10 tracking-editorial">
          Three offers worth your attention.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <SlidePick label="Highest" buyer={p.overview.highest.buyer} price={p.overview.highest.price} />
          <SlidePick label="Safest" buyer={p.overview.safest.buyer} price={p.overview.safest.price} accent />
          <SlidePick label="Best balance" buyer={p.overview.best_balance.buyer} price={p.overview.best_balance.price} />
        </div>
      </div>
    ),
  });

  // 4. Headline recommendation
  slides.push({
    label: "Recommendation",
    body: (
      <div>
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="w-4 h-4 text-accent" />
          <p className="eyebrow-plain text-accent">Our recommendation</p>
        </div>
        <h2 className="heading-display text-4xl lg:text-6xl leading-[1.1] tracking-editorial mb-8 max-w-4xl">
          {p.report.best_overall.headline}
        </h2>
        <p className="font-body text-[17px] leading-[1.75] text-foreground/80 max-w-3xl">
          {p.report.best_overall.explanation}
        </p>
      </div>
    ),
  });

  // 5. Each offer card (one slide per offer)
  for (const c of p.cards) {
    slides.push({
      label: c.offer.buyerName,
      body: (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {c.labels.map((l) => (
              <span key={l} className="badge-gold">
                {l}
              </span>
            ))}
          </div>
          <h2 className="heading-display text-4xl lg:text-5xl mb-3 tracking-editorial">
            {c.offer.buyerName}
          </h2>
          <p className="font-body text-[14px] text-muted-foreground tracking-wide mb-8">
            {c.headline}
          </p>
          <p className="font-body text-[17px] leading-[1.7] text-foreground/85 max-w-3xl mb-10">
            {c.what_this_means}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 max-w-3xl">
            {c.pros.length > 0 && (
              <div>
                <p className="eyebrow mb-3">What's working</p>
                <ul className="space-y-2 text-[14.5px] font-body text-foreground/80">
                  {c.pros.map((pp, i) => (
                    <li key={i}>· {pp}</li>
                  ))}
                </ul>
              </div>
            )}
            {c.cons.length > 0 && (
              <div>
                <p className="eyebrow mb-3">Worth knowing</p>
                <ul className="space-y-2 text-[14.5px] font-body text-foreground/80">
                  {c.cons.map((pp, i) => (
                    <li key={i}>· {pp}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ),
    });
  }

  // 6. Tradeoffs
  for (const t of p.tradeoffs) {
    slides.push({
      label: "Tradeoff",
      body: (
        <div>
          <p className="eyebrow mb-5">A tradeoff to discuss</p>
          <h2 className="heading-display text-4xl lg:text-5xl mb-8 tracking-editorial max-w-3xl">
            {t.title}
          </h2>
          <p className="font-body text-[17px] leading-[1.75] text-foreground/80 max-w-3xl">
            {t.body}
          </p>
        </div>
      ),
    });
  }

  // 7. Side-by-side
  slides.push({
    label: "Side-by-side",
    body: (
      <div>
        <p className="eyebrow mb-5">Side-by-side</p>
        <h2 className="heading-display text-3xl lg:text-4xl mb-8 tracking-editorial">
          Every offer, every term.
        </h2>
        <div className="overflow-x-auto card-paper p-2">
          <table className="table-luxe text-[12px]">
            <thead>
              <tr>
                <th></th>
                {p.cards.map((c) => (
                  <th key={c.offer.id}>{c.offer.buyerName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.comparison_rows.slice(1, 8).map((row) => (
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
      </div>
    ),
  });

  // 8. Negotiation path
  slides.push({
    label: "Negotiation path",
    body: (
      <div>
        <p className="eyebrow mb-5">How we'd play this</p>
        <h2 className="heading-display text-4xl lg:text-5xl mb-10 tracking-editorial">
          A clear path forward.
        </h2>
        <ol className="space-y-7 max-w-3xl">
          {p.report.negotiation_path.map((step) => (
            <li key={step.order} className="flex gap-5">
              <span className="score-numeral text-accent w-12 shrink-0">
                {step.order}
              </span>
              <div>
                <h3 className="heading-display text-2xl mb-1">{step.headline}</h3>
                <p className="font-body text-[14.5px] leading-[1.7] text-foreground/80">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    ),
  });

  // 9. Bottom line
  slides.push({
    label: "Bottom line",
    body: (
      <div className="text-center max-w-3xl mx-auto">
        <p className="eyebrow mb-6 justify-center">Bottom line</p>
        <p className="heading-display text-3xl lg:text-5xl italic leading-[1.25] tracking-editorial">
          “{p.bottom_line_for_seller}”
        </p>
      </div>
    ),
  });

  return slides;
}

function CoverStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-key mb-2">{label}</p>
      <p className="score-numeral">{value}</p>
    </div>
  );
}

function SlidePick({
  label,
  buyer,
  price,
  accent,
}: {
  label: string;
  buyer: string;
  price: number;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "card-feature p-7" : "card-paper p-7"}>
      <p className="eyebrow-plain mb-3">{label}</p>
      <p className="heading-display text-2xl mb-2">{buyer}</p>
      <p className="score-numeral mt-2">{fmt(price)}</p>
    </div>
  );
}