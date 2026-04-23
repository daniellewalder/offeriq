import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, code } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: portal, error: portalErr } = await supabase
      .from("shared_portals")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (portalErr) throw portalErr;
    if (!portal) {
      return new Response(JSON.stringify({ error: "Portal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (portal.revoked_at) {
      return new Response(JSON.stringify({ error: "This link has been revoked." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (portal.expires_at && new Date(portal.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This link has expired." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lightweight metadata-only response (no code provided)
    if (!code) {
      return new Response(
        JSON.stringify({
          requires_code: true,
          title: portal.title ?? "Seller Review",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const codeHash = await sha256(String(code).trim().toLowerCase());
    if (codeHash !== portal.access_code_hash) {
      return new Response(JSON.stringify({ error: "Incorrect access code." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the full analysis bundle.
    const dealId = portal.deal_analysis_id;
    const userId = portal.user_id;

    const { data: analysis } = await supabase
      .from("deal_analyses")
      .select("*, properties(*)")
      .eq("id", dealId)
      .maybeSingle();

    const { data: offers } = await supabase
      .from("offers")
      .select("*, documents(*)")
      .eq("deal_analysis_id", dealId)
      .order("created_at", { ascending: true });

    const offerIds = (offers ?? []).map((o: any) => o.id);
    const { data: extracted } = offerIds.length
      ? await supabase
          .from("extracted_offer_fields")
          .select("*")
          .in("offer_id", offerIds)
      : { data: [] as any[] };

    const { data: scores } = offerIds.length
      ? await supabase
          .from("risk_scores")
          .select("*")
          .in("offer_id", offerIds)
      : { data: [] as any[] };

    const { data: priorities } = await supabase
      .from("seller_priorities")
      .select("*")
      .eq("deal_analysis_id", dealId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: leverage } = await supabase
      .from("leverage_suggestions")
      .select("*")
      .eq("deal_analysis_id", dealId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: strategies } = await supabase
      .from("counter_strategies")
      .select("*")
      .eq("deal_analysis_id", dealId)
      .order("generated_at", { ascending: false });

    // Track view (best-effort).
    await supabase
      .from("shared_portals")
      .update({
        last_accessed_at: new Date().toISOString(),
        view_count: (portal.view_count ?? 0) + 1,
      })
      .eq("id", portal.id);

    return new Response(
      JSON.stringify({
        ok: true,
        portal: {
          id: portal.id,
          title: portal.title,
          deal_analysis_id: portal.deal_analysis_id,
        },
        analysis,
        offers: offers ?? [],
        extracted: extracted ?? [],
        scores: scores ?? [],
        priorities,
        leverage,
        strategies: strategies ?? [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});