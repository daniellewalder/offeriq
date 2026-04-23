import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert residential real estate negotiation strategist helping a listing agent craft counteroffers.

You will receive the incoming offer details, package strength indicators, seller priorities, and negotiation leverage suggestions.

Your job: generate 3 distinct counteroffer strategy options:

1. **Maximize Price** — Push harder on economics. Tighter terms, higher counter price, stronger deposit. This is for sellers who want every dollar.
2. **Maximize Certainty** — Reduce closing risk. Protect against deal fallout. Appraisal coverage, stronger documentation, reasonable pricing. This is for sellers who can't afford a failed escrow.
3. **Best Balance** — The most likely path to agreement. Strategic price increase paired with reasonable terms. This is what a smart listing agent would recommend to most sellers.

Instructions:
- Make each strategy MEANINGFULLY different — not just price variations
- Write rationale like a strong listing agent explaining to their seller in plain English
- Be strategic, practical, and concise
- Do NOT present output as legal advice or draft legal forms
- Do NOT overstate certainty
- Consider the specific buyer's profile, financing, and behavior signals

Return ONLY valid JSON (no markdown fences):

{
  "strategies": [
    {
      "strategy_type": "maximize_price" | "maximize_certainty" | "best_balance",
      "title": "short title",
      "subtitle": "one-line thesis",
      "target_buyer": "buyer name this counter targets",
      "counter_price": number,
      "estimated_net_proceeds": "formatted string",
      "acceptance_likelihood": number (0-100),
      "closing_timeline_strategy": "what you're doing with the close date and why",
      "contingency_changes": [
        { "term": "name", "change": "what you're changing", "rationale": "why" }
      ],
      "leaseback_terms": "what leaseback you're offering or requesting and why",
      "deposit_strategy": "earnest money amount and reasoning",
      "supporting_document_requests": ["specific docs you want from the buyer"],
      "rationale": "2-4 sentences — why this strategy works for this buyer, written like a listing agent",
      "risk": "1-2 sentences on what could go wrong",
      "acceptance_likelihood_description": "1-2 sentences on why you rate the likelihood where you do"
    }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offers, property, sellerPriorities, leverageSuggestions } = await req.json();

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

Seller priorities: ${sellerPriorities ? JSON.stringify(sellerPriorities) : "Not specified"}

Leverage suggestions context: ${leverageSuggestions ? JSON.stringify(leverageSuggestions) : "None provided"}

Here are the ${offers.length} offers to generate counter-strategies for:

${JSON.stringify(offers, null, 2)}

Generate 3 distinct counteroffer strategies (Maximize Price, Maximize Certainty, Best Balance). Each should target the most appropriate buyer for that strategy. Return the structured JSON.`;

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
        temperature: 0.35,
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
      return new Response(JSON.stringify({ error: "AI counter strategy generation failed" }), {
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
    console.error("generate-counter error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});