/**
 * Filename heuristics for offer-document intake.
 *
 * These are the *fallback* classifiers that run instantly on the client
 * before (or instead of) an AI pass. Real agents name files chaotically
 * — "FINAL signed RPA - 1234 Oak St - countered v3.pdf",
 * "Smith offer 2 REVISED countered back.pdf", "POF Wells Fargo.pdf" —
 * so the regexes here are intentionally generous about what counts as a
 * counter, a proof of funds, a pre-approval letter, etc.
 *
 * Anything ambiguous should be surfaced to the agent via the manual
 * "which buyer is this?" modal rather than silently mis-grouped.
 */

export const DOC_CATEGORIES = [
  "Purchase Agreement",
  "Seller Counter",
  "Buyer Counter",
  "Proof of Funds",
  "Pre-Approval",
  "Proof of Income",
  "Addenda",
  "Disclosures",
  "Other",
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

/**
 * Map a (possibly very messy) filename to a document category.
 *
 * Order matters: counter-offer wins over plain "RPA"/"purchase agreement"
 * because counters usually contain the words "purchase agreement" too,
 * and we'd rather over-flag a counter than miss one.
 */
export function inferCategory(filename: string): DocCategory {
  // Normalize separators so `\b` works on names like "Johnson_offer_2.pdf".
  const f = filename.toLowerCase().replace(/[_\-]+/g, " ");

  // 1. Counter offers — check before plain RPA, since counters often
  //    say "RPA counter" or "counter to purchase agreement".
  const isSellerCounter =
    /\bseller\s*counter\b/.test(f) ||
    /\bcounter\s*from\s*seller\b/.test(f) ||
    /\bsellers?\s*counter\s*offer\b/.test(f);
  const isBuyerCounter =
    /\bbuyer\s*counter\b/.test(f) ||
    /\bcounter\s*from\s*buyer\b/.test(f) ||
    /\bbuyers?\s*counter\s*offer\b/.test(f) ||
    /\bcountered?\s*back\b/.test(f); // "countered back" = buyer responded
  if (isSellerCounter) return "Seller Counter";
  if (isBuyerCounter) return "Buyer Counter";
  // Generic counter — assume seller counter (most common in listing-side workflow).
  if (/\bcounter(ed|s|\s*offer)?\b/.test(f) || /\bco\s*#?\d/.test(f)) {
    return "Seller Counter";
  }

  // 2. Proof of funds variants
  if (
    /\bpof\b/.test(f) ||
    /proof\s*of\s*funds/.test(f) ||
    /bank\s*statement/.test(f) ||
    /brokerage\s*statement/.test(f) ||
    /asset\s*verification/.test(f)
  ) {
    return "Proof of Funds";
  }

  // 3. Pre-approval / loan approval variants
  if (
    /pre[-\s]*approval/.test(f) ||
    /preapproval/.test(f) ||
    /pre[-\s]*qual/.test(f) ||
    /\bdu\b.*approval/.test(f) ||
    /desktop\s*underwrit/.test(f) ||
    /loan\s*approval/.test(f) ||
    /loan\s*commitment/.test(f) ||
    /lender\s*letter/.test(f) ||
    /\b1003\b/.test(f) // Fannie Mae uniform residential loan application
  ) {
    return "Pre-Approval";
  }

  // 4. Income docs
  if (
    /\bw[-\s]?2\b/.test(f) ||
    /pay\s*stub/.test(f) ||
    /paystub/.test(f) ||
    /tax\s*return/.test(f) ||
    /\b1040\b/.test(f) ||
    /proof\s*of\s*income/.test(f) ||
    /income\s*verification/.test(f)
  ) {
    return "Proof of Income";
  }

  // 5. Addenda / disclosures
  if (/addend(a|um)/.test(f)) return "Addenda";
  if (/disclosure/.test(f) || /\btds\b/.test(f) || /\bspq\b/.test(f)) {
    return "Disclosures";
  }

  // 6. Purchase agreement variants
  if (
    /\brpa\b/.test(f) ||
    /residential\s*purchase/.test(f) ||
    /purchase\s*agreement/.test(f) ||
    /purchase\s*contract/.test(f) ||
    /\bofferrpa\b/.test(f) ||
    /\boffer\b/.test(f)
  ) {
    return "Purchase Agreement";
  }

  return "Other";
}

/**
 * Cheap filename-only buyer-key inference. Strips doc-type tokens, dates,
 * version markers, and addresses, then keeps the first couple of meaningful
 * words. Used as a fallback when the AI classifier is unavailable or
 * uncertain — the AI pass should always win when present.
 */
export function inferBuyerKey(filename: string): string {
  const stem = filename.replace(/\.[^./]+$/, "");

  // Strip the obvious non-buyer noise.
  const stripped = stem
    // doc types
    .replace(
      /\b(purchase\s*agreement|rpa|residential\s*purchase|offer|counter(ed|s|\s*offer)?|seller\s*counter|buyer\s*counter|pre[-\s]*approval|preapproval|proof\s*of\s*funds|pof|bank\s*statement|du\s*approval|loan\s*approval|loan\s*commitment|1003|w[-\s]?2|pay\s*stub|paystub|tax\s*return|disclosure[s]?|tds|spq|addend(a|um))\b/gi,
      " ",
    )
    // workflow words
    .replace(/\b(final|signed|fully\s*executed|executed|draft|revised|revision|copy|scan|scanned|version|ver|v\d+|rev\s*\d+|round\s*\d+|countersigned)\b/gi, " ")
    // street-address-ish chunks: "1234 Oak St", "123 Main Ave"
    .replace(/\b\d{1,5}\s+[a-z]+(\s+(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|ct|court|way|pl|place))\b/gi, " ")
    // bare numbers, dates, hashes
    .replace(/\b\d{1,2}[-/]\d{1,2}([-/]\d{2,4})?\b/g, " ")
    .replace(/#\s*\d+/g, " ")
    .replace(/\b\d+\b/g, " ")
    // separators
    .replace(/[_\-()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = stripped.split(" ").filter((w) => w.length > 1).slice(0, 3);
  const key = words.join(" ").toLowerCase();
  return key || stem.toLowerCase();
}

export function titleCaseBuyerKey(key: string): string {
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}
