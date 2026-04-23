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

    const { offers, weights, property, deal_analysis_id } = await req.json();
    if (!offers || !weights) {
      return new Response(JSON.stringify({ error: "Missing offers or weights" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an elite real estate strategist helping a seller rank competing offers based on their priorities. Be specific, reference actual offer data, and explain how priority weights affect the ranking. Write like a top listing agent advising their client.`;

    const userPrompt = `Rank these offers on ${property?.address || "the property"} (listed at $${property?.listingPrice?.toLocaleString() || "N/A"}) based on the seller's priority weights.

Seller Priority Weights (0-100 scale):
${JSON.stringify(weights, null, 2)}

Offers:
${JSON.stringify(offers, null, 2)}

Use the rank_offers tool to return your analysis.`;

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
            name: "rank_offers",
            description: "Return ranked offer analysis based on seller priorities",
            parameters: {
              type: "object",
              properties: {
                ranked_offers: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      buyer: { type: "string" },
                      rank: { type: "number" },
                      composite_score: { type: "number" },
                      headline: { type: "string" },
                      strengths: { type: "array", items: { type: "string" } },
                      weaknesses: { type: "array", items: { type: "string" } },
                    },
                    required: ["buyer", "rank", "composite_score", "headline"],
                  },
                },
                priority_impact_summary: { type: "string" },
                weight_sensitivity_notes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      priority: { type: "string" },
                      note: { type: "string" },
                    },
                    required: ["priority", "note"],
                  },
                },
                recommendation: { type: "string" },
              },
              required: ["ranked_offers", "priority_impact_summary", "recommendation"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "rank_offers" } },
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

      const { data: existing } = await supabase
        .from("seller_priorities")
        .select("id")
        .eq("deal_analysis_id", deal_analysis_id)
        .maybeSingle();

      if (existing) {
        await supabase.from("seller_priorities").update({
          price_weight: weights.price,
          certainty_weight: weights.certainty,
          contingencies_weight: weights.contingencies,
          speed_weight: weights.speed,
          leaseback_weight: weights.leaseback,
          repair_weight: weights.repair,
          financial_weight: weights.financial,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      }
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("rank-offers error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});