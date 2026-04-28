import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-4-20250514";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert real estate contract analyst specializing in California residential purchase agreements (RPA) and offer packages.

Your job is to extract structured data from offer documents. Be precise and conservative — only extract data that is explicitly stated. If a field is not present or unclear, use null.

Always return valid JSON matching the exact schema provided. Do not add commentary, markdown, or any text outside the JSON object.`;

const EXTRACTION_PROMPT = `Extract all offer terms from this real estate document and return a JSON object with exactly this structure:

{
  "buyer": {
    "name": string | null,
    "agent_name": string | null,
    "agent_brokerage": string | null,
    "is_represented": boolean
  },
  "property": {
    "address": string | null,
    "apn": string | null
  },
  "price": {
    "offer_price": number | null,
    "initial_deposit": number | null,
    "initial_deposit_days": number | null,
    "increased_deposit": number | null,
    "increased_deposit_days": number | null,
    "down_payment": number | null,
    "loan_amount": number | null,
    "finance_type": "conventional" | "fha" | "va" | "cash" | "other" | null
  },
  "financing": {
    "is_cash_offer": boolean,
    "loan_type": string | null,
    "loan_term_years": number | null,
    "interest_rate_max": number | null,
    "loan_contingency": boolean,
    "loan_contingency_days": number | null,
    "pre_approval_attached": boolean,
    "proof_of_funds_attached": boolean
  },
  "contingencies": {
    "inspection": boolean,
    "inspection_days": number | null,
    "appraisal": boolean,
    "appraisal_days": number | null,
    "appraisal_waived": boolean,
    "loan": boolean,
    "loan_days": number | null,
    "sale_of_property": boolean,
    "sale_of_property_address": string | null,
    "investigation": boolean,
    "investigation_days": number | null,
    "title": boolean,
    "title_days": number | null,
    "other_contingencies": string[]
  },
  "timeline": {
    "offer_date": string | null,
    "offer_expiration": string | null,
    "close_of_escrow_days": number | null,
    "close_of_escrow_date": string | null,
    "possession_days_after_coe": number | null
  },
  "credits_and_costs": {
    "seller_credits": number | null,
    "seller_credit_description": string | null,
    "buyer_pays_transfer_tax": boolean | null,
    "home_warranty_amount": number | null,
    "home_warranty_paid_by": "buyer" | "seller" | "split" | null,
    "escrow_company_preference": string | null,
    "title_company_preference": string | null
  },
  "terms": {
    "as_is": boolean,
    "leaseback_requested": boolean,
    "leaseback_days": number | null,
    "leaseback_rent_per_day": number | null,
    "personal_property_included": string[],
    "personal_property_excluded": string[],
    "inclusions": string[],
    "exclusions": string[],
    "additional_terms": string | null
  },
  "risk_flags": {
    "has_escalation_clause": boolean,
    "escalation_cap": number | null,
    "escalation_increment": number | null,
    "contingencies_waived_count": number,
    "buyer_has_financing_risk": boolean,
    "offer_notes": string | null
  },
  "document_meta": {
    "document_type": "rpa" | "counter_offer" | "addendum" | "pre_approval" | "proof_of_funds" | "disclosure" | "other",
    "confidence": "high" | "medium" | "low",
    "missing_fields": string[],
    "extraction_notes": string | null
  }
}

Rules:
- All dollar amounts as plain numbers (no $ or commas)
- All dates as ISO 8601 strings (YYYY-MM-DD) when possible
- contingencies_waived_count: count of contingencies that are explicitly waived or removed
- buyer_has_financing_risk: true if financed offer with short loan contingency (<17 days) or no pre-approval
- missing_fields: list field names that were expected but not found in the document
- confidence: "high" if most fields found, "medium" if partial, "low" if very little data extracted`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
    }

    const contentType = req.headers.get("content-type") || "";

    let pdfBase64: string;
    let fileName: string = "offer.pdf";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("pdf") as File;

      if (!file) {
        return new Response(JSON.stringify({ error: "No PDF file provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      fileName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      pdfBase64 = btoa(String.fromCharCode(...uint8Array));
    } else {
      // Accept raw JSON with base64 PDF
      const body = await req.json();
      if (!body.pdf_base64) {
        return new Response(JSON.stringify({ error: "No pdf_base64 field in request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBase64 = body.pdf_base64;
      fileName = body.file_name || "offer.pdf";
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                type: "text",
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Anthropic API error:", response.status, errorBody);
      throw new Error(`Anthropic API returned ${response.status}: ${errorBody}`);
    }

    const claudeResponse = await response.json();
    const rawText = claudeResponse.content?.[0]?.text;

    if (!rawText) {
      throw new Error("No content in Claude response");
    }

    // Strip any markdown code fences if Claude adds them
    const cleanJson = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let extractedData: Record<string, unknown>;
    try {
      extractedData = JSON.parse(cleanJson);
    } catch {
      console.error("Failed to parse Claude JSON output:", cleanJson);
      throw new Error("Claude returned invalid JSON — could not parse extraction result");
    }

    return new Response(
      JSON.stringify({
        success: true,
        file_name: fileName,
        extracted: extractedData,
        usage: claudeResponse.usage,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("extract-offer function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
