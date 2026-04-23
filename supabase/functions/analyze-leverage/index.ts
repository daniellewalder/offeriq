import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert real estate negotiation strategist helping a listing agent identify leverage points.

You will receive an incoming offer, seller priorities, and property context.

Your job: identify negotiation terms that create HIGH value for the seller while creating LOW friction for the buyer.

Examples of leverage terms:
- Leaseback (rent-free post-close occupancy)
- Flexible closing date
- Shorter inspection timeline
- Stronger earnest money deposit
- Reduced or eliminated repair requests
- Timing coordination
- Cleaner contingency structure
- Appraisal gap coverage
- Escalation clauses
- As-is with defined credit

Instructions:
- Focus on terms that meaningfully improve seller appeal without necessarily increasing buyer cost in a major way
- Explain WHY each term matters — like a smart listing agent talking to their seller
- Be practical, realistic, and strategic
- Do NOT give legal advice
- Do NOT overstate certainty

For each suggestion, label:
- seller_impact: low / medium / high
- buyer_friction: low / medium / high
- negotiation_value: low / medium / high

Return ONLY valid JSON (no markdown fences):

{
  "leverage_suggestions": [
    {
      "term": "short name of the term",
      "category": "leaseback | timing | deposit | contingency | appraisal | repair | concession | structure",
      "headline": "one-sentence summary of what to do",
      "reasoning": "2-3 sentences explaining why this works and the tradeoff",
      "seller_impact": "low | medium | high",
      "buyer_friction": "low | medium | high",
      "negotiation_value": "low | medium | high",
      "seller_gets": "what the seller gains",
      "buyer_gives": "what the buyer gives up (or why it costs them little)",
      "applicable_buyers": ["buyer names this applies to most"]
    }
  ],
  "easiest_wins": ["1-2 sentence descriptions of the lowest-friction, highest-value moves"],
  "highest_impact_terms": ["1-2 sentence descriptions of the terms with the biggest seller upside"],
  "notes": "1-2 sentences of overall strategic context or caution"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offers, property, sellerPriorities } = await req.json();

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

Here are the ${offers.length} offers to analyze for leverage opportunities:

${JSON.stringify(offers, null, 2)}

Identify the best leverage points and return the structured JSON.`;

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
      return new Response(JSON.stringify({ error: "AI leverage analysis failed" }), {
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
    console.error("analyze-leverage error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});