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

    const { offer, documents, property } = await req.json();
    if (!offer) {
      return new Response(JSON.stringify({ error: "offer data is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert buyer-side real estate offer strategist reviewing an offer package BEFORE submission.

Your job:
- Identify missing items that weaken the package
- Identify weak points that reduce competitiveness
- Identify stale or incomplete documentation
- Suggest specific, actionable ways to strengthen the package

Be practical, conservative, concise. Write like a smart buyer's agent. Score submission_confidence conservatively (most packages 55-85).`;

    const userPrompt = `Property: ${property?.address || "Unknown"}, Listed at $${(property?.listingPrice || 0).toLocaleString()}

Offer details:
${JSON.stringify(offer, null, 2)}

Documents included:
${documents ? JSON.stringify(documents, null, 2) : "No document list provided"}

Review this offer package for submission readiness.`;

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
            name: "review_package",
            description: "Return structured offer package readiness assessment",
            parameters: {
              type: "object",
              properties: {
                submission_confidence_score: { type: "number", description: "0-100 confidence score" },
                checklist: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      item: { type: "string" },
                      status: { type: "string", enum: ["complete", "warning", "missing"] },
                      note: { type: "string" },
                    },
                    required: ["item", "status", "note"],
                  },
                },
                missing_items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      item: { type: "string" },
                      impact: { type: "string" },
                      urgency: { type: "string", enum: ["critical", "important", "minor"] },
                    },
                    required: ["item", "impact", "urgency"],
                  },
                },
                weak_points: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      issue: { type: "string" },
                      why_it_matters: { type: "string" },
                      fix: { type: "string" },
                    },
                    required: ["issue", "why_it_matters", "fix"],
                  },
                },
                strengths: { type: "array", items: { type: "string" } },
                recommended_improvements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      action: { type: "string" },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                      reasoning: { type: "string" },
                    },
                    required: ["action", "priority", "reasoning"],
                  },
                },
                overall_summary: { type: "string" },
                scores: {
                  type: "object",
                  properties: {
                    offer_strength: { type: "number" },
                    financial_confidence: { type: "number" },
                    contingency_risk: { type: "number" },
                    timing_risk: { type: "number" },
                    package_completeness: { type: "number" },
                    close_probability: { type: "number" },
                  },
                  required: ["offer_strength", "financial_confidence", "contingency_risk", "timing_risk", "package_completeness", "close_probability"],
                },
              },
              required: ["submission_confidence_score", "checklist", "missing_items", "weak_points", "strengths", "recommended_improvements", "overall_summary", "scores"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "review_package" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted. Add funds in Settings > Workspace > Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI package review failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call returned from AI");

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, analysis }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("review-package error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});