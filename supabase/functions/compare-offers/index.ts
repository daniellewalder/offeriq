import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { offers, property, deal_analysis_id } = await req.json();
    if (!offers || !Array.isArray(offers)) {
      return new Response(JSON.stringify({ error: "Missing offers array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an elite buyer-side real estate strategist analyzing competing offers on a luxury property. Be specific, data-driven, and opinionated. Reference actual numbers from the offers. Write like a top listing agent would talk to their client — confident, practical, no hedging.`;

    const userPrompt = `Analyze these ${offers.length} offers on ${property?.address || "the property"} (listed at $${property?.listingPrice?.toLocaleString() || "N/A"}).

Offers:
${JSON.stringify(offers, null, 2)}

Return your analysis using the compare_offers tool.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "compare_offers",
            description: "Return structured offer comparison analysis",
            parameters: {
              type: "object",
              properties: {
                highest_offer: {
                  type: "object",
                  properties: { buyer: { type: "string" }, price: { type: "number" }, note: { type: "string" } },
                  required: ["buyer", "price", "note"],
                },
                safest_offer: {
                  type: "object",
                  properties: { buyer: { type: "string" }, close_probability: { type: "number" }, note: { type: "string" } },
                  required: ["buyer", "close_probability", "note"],
                },
                cleanest_offer: {
                  type: "object",
                  properties: { buyer: { type: "string" }, contingency_count: { type: "number" }, note: { type: "string" } },
                  required: ["buyer", "contingency_count", "note"],
                },
                best_balance_offer: {
                  type: "object",
                  properties: { buyer: { type: "string" }, note: { type: "string" } },
                  required: ["buyer", "note"],
                },
                ranking_summary: { type: "string" },
                offer_by_offer_notes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { buyer: { type: "string" }, headline: { type: "string" }, analysis: { type: "string" } },
                    required: ["buyer", "headline", "analysis"],
                  },
                },
                top_tradeoffs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { tradeoff: { type: "string" }, recommendation: { type: "string" } },
                    required: ["tradeoff", "recommendation"],
                  },
                },
              },
              required: ["highest_offer", "safest_offer", "cleanest_offer", "best_balance_offer", "ranking_summary", "offer_by_offer_notes", "top_tradeoffs"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "compare_offers" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted. Add funds in Settings > Workspace > Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call returned from AI");

    const analysis = JSON.parse(toolCall.function.arguments);

    // Save to DB if deal_analysis_id provided
    if (deal_analysis_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      await supabase.from("activity_logs").insert({
        user_id: deal_analysis_id, // will be replaced with real user_id in auth flow
        deal_analysis_id,
        action: "AI comparison analysis completed",
        entity_type: "deal_analysis",
        entity_id: deal_analysis_id,
        metadata: { analysis_type: "compare_offers", offers_count: offers.length },
      });
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("compare-offers error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});