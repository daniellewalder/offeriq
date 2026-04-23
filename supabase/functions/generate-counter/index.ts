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

    const { offers, property } = await req.json();
    if (!offers || !Array.isArray(offers)) {
      return new Response(JSON.stringify({ error: "Missing offers array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an elite real estate counter-offer strategist. Generate three distinct counter-offer strategies: one to maximize price, one to maximize certainty, and one for the best balance. Each targets a specific offer. Be specific with counter prices, terms, timelines. Reference actual offer data. Write rationale like a top luxury listing agent.`;

    const userPrompt = `Generate 3 counter-offer strategies for ${property?.address || "the property"} (listed at $${property?.listingPrice?.toLocaleString() || "N/A"}).

Offers:
${JSON.stringify(offers, null, 2)}

Use the generate_counter_strategies tool.`;

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
            name: "generate_counter_strategies",
            description: "Return 3 counter-offer strategies",
            parameters: {
              type: "object",
              properties: {
                strategies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      strategy_type: { type: "string", enum: ["maximize_price", "maximize_certainty", "best_balance"] },
                      title: { type: "string" },
                      subtitle: { type: "string" },
                      target_buyer: { type: "string" },
                      counter_price: { type: "number" },
                      acceptance_likelihood: { type: "number" },
                      estimated_net_proceeds: { type: "string" },
                      closing_timeline_strategy: { type: "string" },
                      deposit_strategy: { type: "string" },
                      leaseback_terms: { type: "string" },
                      contingency_changes: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            term: { type: "string" },
                            change: { type: "string" },
                            rationale: { type: "string" },
                          },
                          required: ["term", "change", "rationale"],
                        },
                      },
                      supporting_document_requests: { type: "array", items: { type: "string" } },
                      rationale: { type: "string" },
                      risk: { type: "string" },
                      acceptance_likelihood_description: { type: "string" },
                    },
                    required: ["strategy_type", "title", "subtitle", "target_buyer", "counter_price", "acceptance_likelihood", "rationale", "risk"],
                  },
                },
              },
              required: ["strategies"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_counter_strategies" } },
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

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-counter error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});