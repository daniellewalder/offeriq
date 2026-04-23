import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an AI decision-support assistant for real estate negotiations, helping a listing agent advise their seller.

You will receive structured data for multiple offers along with seller priority weights (0-100 scale).

Your job:
1. Re-rank the offers based on what matters most to the seller
2. Explain why the ranking changes when seller priorities shift
3. Focus on tradeoffs — be practical and strategic
4. Do not make legal claims
5. Do not overstate certainty when data is incomplete
6. Write like a smart listing agent explaining to a seller in plain English

Possible seller priorities (each weighted 0-100):
- price: Highest net proceeds
- certainty: Likelihood of closing
- speed: Fastest close timeline
- contingencies: Minimal contingencies / clean terms
- financial: Strongest buyer financial profile
- leaseback: Leaseback flexibility
- repair: Minimal repair negotiation risk

Return ONLY valid JSON (no markdown fences) with this structure:

{
  "ranked_offers": [
    {
      "rank": 1,
      "buyer": "name",
      "score_rationale": "1-2 sentences on why this offer ranks here given the seller's priorities"
    }
  ],
  "recommended_offer": {
    "buyer": "name",
    "why_this_offer_is_best_for_these_priorities": "2-3 sentence strategic explanation"
  },
  "priority_conflicts": [
    "Short description of where the seller's priorities create tension — e.g. wanting both highest price and fastest close"
  ],
  "caution_flags": [
    "Specific risks or gaps in the data the seller should be aware of"
  ],
  "priority_shift_insight": "1-2 sentences explaining what would change if the seller shifted their top priority"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offers, weights, property } = await req.json();

    if (!offers || !Array.isArray(offers) || !weights) {
      return new Response(
        JSON.stringify({ error: "offers array and weights object are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userPrompt = `Property: ${property?.address || "Unknown"}, Listed at ${property?.listingPrice || "N/A"}

Seller Priority Weights (0-100, higher = more important):
${Object.entries(weights).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Offers to rank:
${JSON.stringify(offers, null, 2)}

Re-rank these offers based on the seller's stated priorities and return the structured JSON.`;

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
      return new Response(JSON.stringify({ error: "AI ranking failed" }), {
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
    console.error("rank-offers error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});