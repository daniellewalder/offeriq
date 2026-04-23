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

    const systemPrompt = `You are an elite real estate negotiation strategist. Identify leverage points where a small seller concession or a smart counter-ask creates outsized value. Focus on terms with high seller impact and low buyer friction. Be specific, cite actual numbers from the offers, and write like a top luxury listing agent.`;

    const userPrompt = `Analyze these ${offers.length} offers on ${property?.address || "the property"} (listed at $${property?.listingPrice?.toLocaleString() || "N/A"}) for negotiation leverage.

Offers:
${JSON.stringify(offers, null, 2)}

Use the analyze_leverage tool to return your analysis.`;

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
            name: "analyze_leverage",
            description: "Return leverage analysis with easiest wins, highest impact terms, and detailed suggestions",
            parameters: {
              type: "object",
              properties: {
                easiest_wins: { type: "array", items: { type: "string" } },
                highest_impact_terms: { type: "array", items: { type: "string" } },
                leverage_suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      term: { type: "string" },
                      headline: { type: "string" },
                      reasoning: { type: "string" },
                      seller_impact: { type: "string", enum: ["high", "medium", "low"] },
                      buyer_friction: { type: "string", enum: ["low", "medium", "high"] },
                      seller_gets: { type: "string" },
                      buyer_gives: { type: "string" },
                      applicable_buyers: { type: "array", items: { type: "string" } },
                    },
                    required: ["category", "term", "headline", "reasoning", "seller_impact", "buyer_friction", "seller_gets", "buyer_gives"],
                  },
                },
                notes: { type: "string" },
              },
              required: ["easiest_wins", "highest_impact_terms", "leverage_suggestions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "analyze_leverage" } },
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
    console.error("analyze-leverage error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});