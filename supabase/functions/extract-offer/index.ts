import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro"; // accuracy on long contracts

interface DocInput {
  id: string;
  name: string;
  category: string;
}

interface DocWithText extends DocInput {
  text: string;
  error?: string;
}

interface ExtractedField {
  field_name: string;
  field_value: any;
  confidence: number;
  evidence: string | null;
  source_document_id: string | null;
  source_document_name: string | null;
}

// ─── PDF / text parsing ─────────────────────────────────────────────────────

async function downloadAndParse(
  supabase: any,
  doc: { id: string; name: string; file_path: string | null; mime_type: string | null; extracted_text: string | null },
): Promise<{ text: string; error?: string }> {
  // Use cached text if available
  if (doc.extracted_text && doc.extracted_text.length > 0) {
    return { text: doc.extracted_text };
  }
  if (!doc.file_path) {
    return { text: "", error: "No file_path on document" };
  }

  try {
    const { data, error } = await supabase.storage
      .from("offer-documents")
      .download(doc.file_path);
    if (error || !data) {
      return { text: "", error: `Storage download failed: ${error?.message ?? "unknown"}` };
    }

    const mime = (doc.mime_type ?? "").toLowerCase();
    const isPdf = mime.includes("pdf") || doc.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      const buf = new Uint8Array(await data.arrayBuffer());
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: true });
      const cleaned = (Array.isArray(text) ? text.join("\n") : text).trim();
      return { text: cleaned };
    }

    // Text-like fallbacks
    if (
      mime.startsWith("text/") ||
      mime.includes("json") ||
      mime.includes("csv") ||
      doc.name.match(/\.(txt|md|csv|json)$/i)
    ) {
      const text = await data.text();
      return { text: text.trim() };
    }

    // Images / docx / unknown — skip parsing, model will rely on category + name
    return {
      text: "",
      error: `Unsupported mime "${mime}" — parsed as metadata-only.`,
    };
  } catch (e: any) {
    return { text: "", error: `Parse error: ${e?.message ?? String(e)}` };
  }
}

function truncate(s: string, max = 25000): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n\n[...truncated ${s.length - max} chars...]`;
}

// ─── Lovable AI extraction ───────────────────────────────────────────────────

const EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "record_offer_extraction",
    description:
      "Record every offer term you can find in the documents, with exact quotes as evidence and a calibrated confidence score.",
    parameters: {
      type: "object",
      properties: {
        fields: {
          type: "array",
          description: "One entry per extracted field. Use null for value when not found.",
          items: {
            type: "object",
            properties: {
              field_name: {
                type: "string",
                enum: [
                  "buyer_name",
                  "offer_price",
                  "financing_type",
                  "loan_amount",
                  "down_payment_amount",
                  "down_payment_percent",
                  "earnest_money_deposit",
                  "close_of_escrow_days",
                  "inspection_contingency_present",
                  "inspection_contingency_days",
                  "appraisal_contingency_present",
                  "appraisal_contingency_days",
                  "loan_contingency_present",
                  "loan_contingency_days",
                  "leaseback_requested",
                  "leaseback_days",
                  "concessions_requested",
                  "proof_of_funds_present",
                  "preapproval_present",
                  "agent_name",
                  "agent_brokerage",
                  "special_notes",
                ],
              },
              field_value: {
                description:
                  "The extracted value: number for amounts/days/percent, boolean for *_present, string otherwise. Use null if not found.",
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description: "0 = not found, 1 = explicitly and unambiguously stated",
              },
              evidence: {
                type: ["string", "null"],
                description:
                  "The literal quoted sentence or phrase from the document supporting this value. Null if not found.",
              },
              source_document_name: {
                type: ["string", "null"],
                description: "Name of the document this field was extracted from.",
              },
            },
            required: ["field_name", "field_value", "confidence", "evidence", "source_document_name"],
          },
        },
        missing_items: {
          type: "array",
          items: { type: "string" },
          description: "List any standard offer-package items that are missing or unclear.",
        },
        notable_risks: {
          type: "array",
          items: { type: "string" },
          description: "Plain-English risks a listing agent should flag for the seller.",
        },
        notable_strengths: {
          type: "array",
          items: { type: "string" },
          description: "Plain-English strengths worth highlighting.",
        },
        counter_chain: {
          type: "array",
          description:
            "Ordered negotiation history. The FIRST entry MUST be the buyer's original offer. Each subsequent entry is a counter document (Seller Counter or Buyer Counter category). Do NOT include this if there is only one document and no counters.",
          items: {
            type: "object",
            properties: {
              party: { type: "string", enum: ["buyer", "seller"], description: "Who issued this offer/counter." },
              price: { type: ["number", "null"], description: "The price proposed in this round." },
              key_changes: {
                type: "array",
                items: { type: "string" },
                description: "Plain-English bullets describing what changed vs. the prior round (e.g. 'price up $240k', 'added 3-month $1 leaseback').",
              },
              source_document: { type: ["string", "null"], description: "Name of the document this round came from." },
              label: { type: ["string", "null"], description: "Short label, e.g. 'Original offer', 'Seller counter #1'." },
            },
            required: ["party", "price", "key_changes", "source_document", "label"],
          },
        },
        counter_status: {
          type: "string",
          enum: ["none", "seller_countered", "buyer_countered", "accepted"],
          description: "Current state of the negotiation based on the documents provided.",
        },
      },
      required: ["fields", "missing_items", "notable_risks", "notable_strengths"],
    },
  },
} as const;

const SYSTEM_PROMPT = `You are an expert real-estate transaction analyst helping a listing agent evaluate a buyer's offer package.

You will be given the full text of one or more documents from a single offer package (purchase agreement, pre-approval letter, proof of funds, addenda, disclosures, etc.).

Your job:
1. Extract every standard offer term you can find.
2. For each field, return the literal quoted sentence from the document as 'evidence'. If a field is not found, set value to null, confidence to 0, and evidence to null.
3. Calibrate confidence honestly: 0.95+ only when the value is explicitly stated. 0.5-0.8 when inferred. 0 when missing.
4. Cite which document each field came from (use the document name shown in the input).
5. Cross-reference: if the purchase agreement says one price and the pre-approval says another, list it under notable_risks with both quotes.
6. Identify missing items (e.g. "no proof of funds", "earnest money amount not stated").
7. Identify risks and strengths a listing agent would flag for their seller.

CRITICAL — COUNTER OFFERS:
Documents have a "category" tag. Look for "Seller Counter" or "Buyer Counter" categories, OR documents whose name/text obviously contains "counter offer".

- The TOP-LEVEL fields (offer_price, earnest_money_deposit, etc.) MUST always reflect the BUYER'S ORIGINAL OFFER from the Purchase Agreement. NEVER overwrite the original offer_price with a counter price.
- For each counter document, add an entry to counter_chain with party (seller/buyer), the new price proposed, and key_changes vs. the previous round.
- The first counter_chain entry must always be the buyer's original offer (party: "buyer", price: original offer price, label: "Original offer").
- Set counter_status accordingly: "none" if no counters, "seller_countered" if the latest doc is a seller counter, "buyer_countered" if the latest is a buyer counter, "accepted" only if a document explicitly shows mutual acceptance/signatures.
- For source_document on the original offer fields, cite the Purchase Agreement document — NOT the counter doc — even when the counter restates the price.

Return ONLY by calling the record_offer_extraction tool. Do not write any prose response.`;

async function callLovableAI(
  apiKey: string,
  documents: DocWithText[],
  offerName: string,
): Promise<{ extraction: any; error?: string }> {
  const docPayload = documents
    .map((d) => {
      const header = `=== DOCUMENT: ${d.name} (category: ${d.category}) ===`;
      const body = d.text ? truncate(d.text) : `[Document could not be parsed: ${d.error ?? "unknown"}. Treat as missing.]`;
      return `${header}\n${body}`;
    })
    .join("\n\n");

  const userMessage = `Buyer / offer label: ${offerName}\n\nDocuments:\n\n${docPayload}\n\nExtract every offer term. Use the tool.`;

  const resp = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "function", function: { name: "record_offer_extraction" } },
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    if (resp.status === 429) {
      return { extraction: null, error: "AI rate limit exceeded — please try again in a minute." };
    }
    if (resp.status === 402) {
      return { extraction: null, error: "AI credits exhausted — add credits in Lovable Cloud workspace settings." };
    }
    return { extraction: null, error: `AI gateway error ${resp.status}: ${txt.slice(0, 300)}` };
  }

  const data = await resp.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    return { extraction: null, error: "Model did not return a tool call" };
  }
  try {
    const args = JSON.parse(toolCall.function.arguments);
    return { extraction: args };
  } catch (e: any) {
    return { extraction: null, error: `Could not parse model output: ${e?.message ?? e}` };
  }
}

// ─── Field normalization ────────────────────────────────────────────────────

function normalizeFields(
  raw: any,
  docs: DocWithText[],
): { fields: ExtractedField[]; missing_items: string[]; notable_risks: string[]; notable_strengths: string[] } {
  const docByName = new Map(docs.map((d) => [d.name, d]));

  const fields: ExtractedField[] = (raw?.fields ?? []).map((f: any) => {
    const sourceDoc = f.source_document_name ? docByName.get(f.source_document_name) : null;
    return {
      field_name: f.field_name,
      field_value: f.field_value,
      confidence: typeof f.confidence === "number" ? f.confidence : 0,
      evidence: f.evidence ?? null,
      source_document_id: sourceDoc?.id ?? null,
      source_document_name: f.source_document_name ?? null,
    };
  });

  return {
    fields,
    missing_items: Array.isArray(raw?.missing_items) ? raw.missing_items : [],
    notable_risks: Array.isArray(raw?.notable_risks) ? raw.notable_risks : [],
    notable_strengths: Array.isArray(raw?.notable_strengths) ? raw.notable_strengths : [],
  };
}

function fieldMapFrom(fields: ExtractedField[]): Record<string, any> {
  const m: Record<string, any> = {};
  for (const f of fields) {
    if (f.field_value !== null && f.field_value !== undefined && f.confidence > 0.3) {
      m[f.field_name] = f.field_value;
    }
  }
  return m;
}

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { offer_id, offer_name, documents } = body as {
      offer_id: string;
      offer_name: string;
      documents: DocInput[];
    };
    if (!offer_id || !offer_name || !Array.isArray(documents) || documents.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing offer_id, offer_name, or documents" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify ownership
    const { data: offer, error: offerErr } = await supabase
      .from("offers")
      .select("id, user_id")
      .eq("id", offer_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (offerErr || !offer) {
      return new Response(
        JSON.stringify({ error: "Offer not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load full document records (file_path, mime, cached text)
    const docIds = documents.map((d) => d.id).filter(Boolean);
    const { data: docRows } = await supabase
      .from("documents")
      .select("id, name, category, file_path, mime_type, extracted_text")
      .in("id", docIds);

    const docMap = new Map((docRows ?? []).map((d: any) => [d.id, d]));

    // Mark all as extracting
    await supabase
      .from("documents")
      .update({ status: "extracting" })
      .in("id", docIds);

    // Parse each document
    const parsed: DocWithText[] = [];
    for (const d of documents) {
      const row = docMap.get(d.id);
      if (!row) {
        parsed.push({ id: d.id, name: d.name, category: d.category, text: "", error: "Document row not found" });
        continue;
      }
      const { text, error } = await downloadAndParse(supabase, row);
      parsed.push({ id: d.id, name: d.name, category: d.category, text, error });

      // Cache text + update status per doc
      await supabase
        .from("documents")
        .update({
          extracted_text: text || null,
          extraction_error: error ?? null,
          status: error ? "error" : "verified",
          confidence: text && text.length > 200 ? 95 : text.length > 0 ? 70 : 20,
        })
        .eq("id", d.id);
    }

    // Bail out early if literally nothing parsed
    const anyText = parsed.some((p) => p.text && p.text.length > 50);
    if (!anyText) {
      return new Response(
        JSON.stringify({
          error: "No readable text extracted from any document. Upload PDFs with selectable text or text files.",
          per_document_errors: parsed.map((p) => ({ name: p.name, error: p.error })),
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Run AI extraction
    const { extraction, error: aiErr } = await callLovableAI(lovableKey, parsed, offer_name);
    if (!extraction) {
      return new Response(
        JSON.stringify({ error: aiErr ?? "AI extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { fields, missing_items, notable_risks, notable_strengths } = normalizeFields(extraction, parsed);

    // ─── Counter chain handling ───────────────────────────────────────────
    // Pull counter_chain + counter_status straight off the raw extraction.
    const rawCounterChain: any[] = Array.isArray((extraction as any)?.counter_chain)
      ? (extraction as any).counter_chain
      : [];
    const counterChain = rawCounterChain
      .map((c: any) => ({
        party: c?.party === "seller" ? "seller" : "buyer",
        price: c?.price === null || c?.price === undefined ? null : Number(c.price),
        key_changes: Array.isArray(c?.key_changes) ? c.key_changes.filter((s: any) => typeof s === "string") : [],
        source_document: typeof c?.source_document === "string" ? c.source_document : null,
        label: typeof c?.label === "string" ? c.label : null,
      }))
      .filter((c) => c.price !== null || c.key_changes.length > 0);
    const counterStatus =
      typeof (extraction as any)?.counter_status === "string"
        ? (extraction as any).counter_status
        : counterChain.length > 1
        ? counterChain[counterChain.length - 1].party === "seller"
          ? "seller_countered"
          : "buyer_countered"
        : "none";

    // Versioning
    const { data: existing } = await supabase
      .from("extracted_offer_fields")
      .select("version")
      .eq("offer_id", offer_id)
      .order("version", { ascending: false })
      .limit(1);
    const nextVersion = existing && existing.length > 0 ? (existing[0].version ?? 0) + 1 : 1;

    // Persist per-field rows
    const rows = fields.map((f) => ({
      offer_id,
      field_name: f.field_name,
      field_value: f.field_value,
      confidence: f.confidence,
      evidence: f.evidence,
      source_document_id: f.source_document_id,
      source_document_name: f.source_document_name,
      version: nextVersion,
    }));

    // Append the summary collections as their own field rows so the UI can read them
    rows.push(
      { offer_id, field_name: "missing_items", field_value: missing_items, confidence: 0.9, evidence: null, source_document_id: null, source_document_name: null, version: nextVersion },
      { offer_id, field_name: "notable_risks", field_value: notable_risks, confidence: 0.9, evidence: null, source_document_id: null, source_document_name: null, version: nextVersion },
      { offer_id, field_name: "notable_strengths", field_value: notable_strengths, confidence: 0.9, evidence: null, source_document_id: null, source_document_name: null, version: nextVersion },
    );

    const { error: insertErr } = await supabase
      .from("extracted_offer_fields")
      .insert(rows);
    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to store extraction", detail: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Roll up into the offers row
    const m = fieldMapFrom(fields);

    // CRITICAL: never let a counter price overwrite the buyer's original offer price.
    // Prefer the price tied to the FIRST counter_chain entry (buyer's original) if it exists.
    const originalFromChain = counterChain.find((c) => c.party === "buyer" && typeof c.price === "number");
    const originalOfferPrice =
      originalFromChain?.price ??
      (typeof m.offer_price === "number" ? m.offer_price : null);
    const contingencies: string[] = [];
    if (m.inspection_contingency_present) {
      contingencies.push(m.inspection_contingency_days ? `Inspection (${m.inspection_contingency_days} days)` : "Inspection");
    }
    if (m.appraisal_contingency_present) contingencies.push("Appraisal");
    if (m.loan_contingency_present) contingencies.push("Loan");

    // Compute completeness from confidence + presence of key docs
    const expected = ["offer_price", "financing_type", "earnest_money_deposit", "close_of_escrow_days", "down_payment_percent"];
    const expectedHits = expected.filter((k) => m[k] !== undefined).length;
    const completeness = Math.round((expectedHits / expected.length) * 100);

    const offerUpdate: Record<string, any> = {
      buyer_name: m.buyer_name ?? offer_name,
      agent_name: m.agent_name ?? null,
      agent_brokerage: m.agent_brokerage ?? null,
      offer_price: originalOfferPrice,
      financing_type: m.financing_type ?? null,
      down_payment: m.down_payment_amount ?? null,
      down_payment_percent: m.down_payment_percent ?? null,
      earnest_money: m.earnest_money_deposit ?? null,
      close_days: m.close_of_escrow_days ?? null,
      close_timeline: m.close_of_escrow_days ? `${m.close_of_escrow_days} days` : null,
      inspection_period: m.inspection_contingency_days ? `${m.inspection_contingency_days} days` : null,
      leaseback_request: m.leaseback_requested
        ? (m.leaseback_days ? `${m.leaseback_days}-day leaseback` : "Requested")
        : "None",
      concessions: m.concessions_requested ?? "None",
      proof_of_funds: m.proof_of_funds_present ?? false,
      pre_approval: m.preapproval_present ?? false,
      contingencies,
      completeness,
      special_notes: m.special_notes ?? null,
      counters: counterChain,
      counter_status: counterStatus,
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabase
      .from("offers")
      .update(offerUpdate)
      .eq("id", offer_id);
    if (updateErr) console.error("Offer update error:", updateErr);

    return new Response(
      JSON.stringify({
        success: true,
        version: nextVersion,
        fields_count: fields.length,
        completeness: `${completeness}%`,
        missing_items,
        notable_risks,
        notable_strengths,
        counter_chain: counterChain,
        counter_status: counterStatus,
        per_document_errors: parsed.filter((p) => p.error).map((p) => ({ name: p.name, error: p.error })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Extraction error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});