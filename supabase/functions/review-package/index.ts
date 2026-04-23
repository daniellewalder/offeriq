import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert buyer-side real estate offer strategist reviewing an offer package BEFORE submission to the listing agent.

Your job:
- Identify missing items that could weaken the package
- Identify weak points that reduce competitiveness
- Identify stale or incomplete documentation
- Identify terms that may make the offer less attractive vs. competing offers
- Suggest specific, actionable ways to strengthen the package

Examples of issues to look for:
- Missing proof of funds or outdated bank statements
- Outdated or expired pre-approval letter
- Incomplete signatures or missing addenda
- Weak earnest money deposit relative to offer price
- Long contingency periods that signal uncertainty
- Unclear close timing
- Missing disclosures or acknowledgments
- No appraisal gap coverage on financed offers
- Disorganized or incomplete package presentation

Instructions:
- Be practical, conservative, and concise
- Write like a smart buyer's agent reviewing before submission
- Do NOT give legal advice
- Do NOT overstate issues — flag what matters
- Score submission_confidence conservatively (most packages score 55-85)

Return ONLY valid JSON (no markdown fences):

{
  "submission_confidence_score": number (0-100),
  "missing_items": [
    { "item": "what's missing", "impact": "why it matters", "urgency": "critical | important | minor" }
  ],
  "weak_points": [
    { "issue": "what's weak", "why_it_matters": "how it hurts competitiveness", "fix": "how to address it" }
  ],
  "stale_items": [
    { "item": "what's outdated", "detail": "why it's stale and what to replace it with" }
  ],
  "strengths": [
    "specific strengths of this package"
  ],
  "recommended_improvements": [
    { "action": "what to do", "priority": "high | medium | low", "reasoning": "why this helps" }
  ],
  "overall_summary": "2-3 sentence strategic assessment of this package's readiness"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offer, documents, property } = await req.json();

    if (!offer) {
      return new Response(
        JSON.stringify({ error: "offer data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userPrompt = `Property: ${property?.address || "Unknown"}, Listed at ${property?.listingPrice || "N/A"}

Offer package to review:
${JSON.stringify(offer, null, 2)}

Documents included in package:
${documents ? JSON.stringify(documents, null, 2) : "No document list provided"}

Review this offer package for submission readiness and return the structured JSON assessment.`;

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
        temperature: 0.25,
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
      return new Response(JSON.stringify({ error: "AI package review failed" }), {
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
    console.error("review-package error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});