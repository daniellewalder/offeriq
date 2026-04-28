import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash"; // fast — we only need a buyer name

/**
 * Classify a batch of uploaded files: identify the buyer name from
 * the document content (not just the filename) so the intake screen
 * can group offers correctly even when filenames are messy.
 *
 * Input (multipart/form-data):
 *   files[]   one or more PDFs (or text-like files). Field name "files".
 *
 * Response:
 *   { results: [{ filename, buyer_name, confidence, reasoning }] }
 *
 * Confidence is 0..1. If the model can't find a buyer (or the file
 * isn't readable), it returns confidence 0 and a null buyer_name —
 * the client falls back to the manual "which buyer?" modal.
 */

const TOOL = {
  type: "function" as const,
  function: {
    name: "classify_documents",
    description: "For each input document, return the buyer name + confidence.",
    parameters: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              filename: { type: "string" },
              buyer_name: {
                type: ["string", "null"],
                description:
                  "Surname (or full name) of the BUYER on this document. Null if not present or ambiguous.",
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description:
                  "0 if not found, 0.95+ when buyer is explicitly named on a signed RPA, lower for inferred matches.",
              },
              reasoning: { type: "string" },
            },
            required: ["filename", "buyer_name", "confidence", "reasoning"],
          },
        },
      },
      required: ["results"],
    },
  },
};

const SYSTEM = `You are a real-estate document classifier. For each document
excerpt you receive, identify the BUYER on the offer (not the seller, not the
agent, not the lender). Prefer surname only when both are clear. If the document
is a buyer's pre-approval, proof of funds, W-2, etc., return the buyer it
belongs to. If you genuinely cannot tell, set buyer_name=null and confidence=0
— DO NOT guess. Always return a result entry for every input filename in the
same order. Use the classify_documents tool only.`;

function truncate(s: string, max = 6000): string {
  return s.length <= max ? s : s.slice(0, max);
}

async function parseFile(file: File): Promise<{ text: string; error?: string }> {
  const name = file.name.toLowerCase();
  const isPdf = (file.type || "").includes("pdf") || name.endsWith(".pdf");
  try {
    if (isPdf) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: true });
      const cleaned = (Array.isArray(text) ? text.join("\n") : text).trim();
      return { text: cleaned };
    }
    if ((file.type || "").startsWith("text/") || /\.(txt|md|csv|json)$/i.test(name)) {
      return { text: (await file.text()).trim() };
    }
    return { text: "", error: `Unsupported type ${file.type || "unknown"}` };
  } catch (e: any) {
    return { text: "", error: `Parse failed: ${e?.message ?? String(e)}` };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = await req.formData();
    const files = form.getAll("files").filter((v): v is File => v instanceof File);
    if (files.length === 0) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse all files, then build a single prompt the model can answer in one call.
    const parsed: { name: string; text: string; error?: string }[] = [];
    for (const f of files) {
      const { text, error } = await parseFile(f);
      parsed.push({ name: f.name, text, error });
    }

    const prompt =
      "Classify the buyer for each of these documents.\n\n" +
      parsed
        .map((d, i) => {
          const head = `=== [${i + 1}] FILE: ${d.name} ===`;
          const body = d.text
            ? truncate(d.text)
            : `[Could not parse: ${d.error ?? "unknown"}]`;
          return `${head}\n${body}`;
        })
        .join("\n\n");

    const aiResp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "classify_documents" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit — try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ error: `AI gateway error ${aiResp.status}: ${txt.slice(0, 300)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let results: any[] = [];
    try {
      const args = JSON.parse(toolCall?.function?.arguments ?? "{}");
      results = Array.isArray(args.results) ? args.results : [];
    } catch {
      results = [];
    }

    // Make sure we return one entry per file, in input order, even if the
    // model dropped some. This keeps the client logic simple.
    const byName = new Map<string, any>();
    for (const r of results) {
      if (r?.filename) byName.set(String(r.filename), r);
    }
    const aligned = parsed.map((p) => {
      const hit = byName.get(p.name);
      if (hit) {
        return {
          filename: p.name,
          buyer_name: hit.buyer_name ?? null,
          confidence: typeof hit.confidence === "number" ? hit.confidence : 0,
          reasoning: hit.reasoning ?? null,
          parse_error: p.error ?? null,
        };
      }
      return {
        filename: p.name,
        buyer_name: null,
        confidence: 0,
        reasoning: "Model did not return a result for this file.",
        parse_error: p.error ?? null,
      };
    });

    return new Response(JSON.stringify({ results: aligned }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("classify-documents error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
