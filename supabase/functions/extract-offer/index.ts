import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_SYSTEM_PROMPT = `You are an expert real estate offer analyst. You read residential real estate offer packages and extract structured information with high precision.

Return a JSON object with the following fields. For EVERY field, return an object with:
- "value": the extracted value (null if not found)
- "confidence": a number from 0 to 1
- "evidence": a direct quote or snippet from the document supporting the value (null if not found)

Fields to extract:
buyer_name, property_address, offer_price, financing_type, loan_amount, down_payment_amount, down_payment_percent, earnest_money_deposit, close_of_escrow_days, requested_close_date, inspection_contingency_present, inspection_contingency_days, appraisal_contingency_present, appraisal_contingency_days, loan_contingency_present, loan_contingency_days, leaseback_requested, leaseback_days, seller_credit_requested, repairs_requested, proof_of_funds_present, proof_of_income_present, preapproval_present, lender_name, addenda_present, disclosure_acknowledgment_present, occupancy_terms, special_requests, package_completeness, missing_items, notable_risks, notable_strengths

Rules:
- Be conservative. Do not guess unless strongly supported by the document.
- If a field is not found, set value to null and confidence to 0.
- package_completeness should be a percentage string like "85%"
- missing_items, notable_risks, notable_strengths should be arrays of strings
- Return ONLY valid JSON, no markdown fences.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentText, documentCategory } = await req.json();

    if (!documentText || typeof documentText !== "string") {
      return new Response(
        JSON.stringify({ error: "documentText is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userPrompt = `Document category: ${documentCategory || "Unknown"}

--- DOCUMENT TEXT ---
${documentText.slice(0, 30000)}
--- END DOCUMENT TEXT ---

Extract all available fields as described. Return only valid JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse JSON from response, stripping markdown fences if present
    let cleanJson = content.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let extracted;
    try {
      extracted = JSON.parse(cleanJson);
    } catch {
      console.error("Failed to parse AI response as JSON:", cleanJson.slice(0, 500));
      return new Response(JSON.stringify({ error: "AI returned invalid JSON", raw: cleanJson.slice(0, 1000) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, extracted }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-offer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});