import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert real estate offer strategist helping a listing agent compare multiple offers on the same property.

You write like a strong listing agent explaining options to a seller — concise, strategic, readable, plain English.

Rules:
- Do NOT assume the highest offer is the best offer.
- Consider contingencies, financing, timing, completeness, and overall closing confidence.
- Avoid legal conclusions.
- Avoid certainty when data is incomplete.
- Be opinionated but fair.

Return ONLY valid JSON (no markdown fences) with these sections:

{
  "highest_offer": { "buyer": "name", "price": number, "note": "one-liner on why price alone isn't the whole story" },
  "safest_offer": { "buyer": "name", "close_probability": number, "note": "why this is the safest path to closing" },
  "cleanest_offer": { "buyer": "name", "contingency_count": number, "note": "why this is the cleanest structurally" },
  "best_balance_offer": { "buyer": "name", "note": "why this is the best overall recommendation" },
  "ranking_summary": "2-3 sentence strategic overview for the seller",
  "offer_by_offer_notes": [
    { "buyer": "name", "headline": "3-5 word summary", "analysis": "2-3 sentence strategic analysis" }
  ],
  "top_tradeoffs": [
    { "tradeoff": "short description of a key decision the seller faces", "recommendation": "what a smart listing agent would advise" }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offers, property } = await req.json();

    if (!offers || !Array.isArray(offers)) {
      return new Response(
        JSON.stringify({ error: "offers array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userPrompt = `Property: ${property?.address || "Unknown"}, Listed at ${property?.listingPrice || "N/A"}
Seller goals: ${property?.sellerGoals?.join(", ") || "Not specified"}
Seller notes: ${property?.sellerNotes || "None"}

Here are the ${offers.length} offers:

${JSON.stringify(offers, null, 2)}

Analyze these offers and return the structured JSON comparison.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI comparison failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    let cleanJson = content.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let analysis;
    try {
      analysis = JSON.parse(cleanJson);
    } catch {
      console.error("Failed to parse AI response:", cleanJson.slice(0, 500));
      return new Response(JSON.stringify({ error: "AI returned invalid JSON", raw: cleanJson.slice(0, 1000) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("compare-offers error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});