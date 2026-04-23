import { supabase } from "@/integrations/supabase/client";

// ─── Deal Analysis ───

export async function getOrCreateDemoAnalysis(userId: string) {
  // Check for an existing demo analysis
  const { data: existing } = await supabase
    .from("deal_analyses")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Demo Analysis — 1247 Stone Canyon Rd")
    .maybeSingle();

  if (existing) return existing.id;

  // Get or create demo property
  const { data: prop } = await supabase
    .from("properties")
    .select("id")
    .eq("user_id", userId)
    .eq("address", "1247 Stone Canyon Rd")
    .maybeSingle();

  let propertyId: string;
  if (prop) {
    propertyId = prop.id;
  } else {
    const { data: newProp, error } = await supabase
      .from("properties")
      .insert({
        user_id: userId,
        address: "1247 Stone Canyon Rd",
        city: "Bel Air, CA 90077",
        listing_price: 8750000,
        property_type: "Single Family",
        status: "Active",
        seller_notes: "Seller wants to net as much as possible. Comfortable with 30-day close. Open to short leaseback.",
        seller_goals: ["Maximize net proceeds", "Close within 35 days", "Avoid repair negotiations"],
      })
      .select("id")
      .single();
    if (error) throw error;
    propertyId = newProp.id;
  }

  const { data: analysis, error } = await supabase
    .from("deal_analyses")
    .insert({
      user_id: userId,
      property_id: propertyId,
      name: "Demo Analysis — 1247 Stone Canyon Rd",
      status: "in_progress",
    })
    .select("id")
    .single();

  if (error) throw error;
  return analysis.id;
}

// ─── Offer Creation ───

export async function createOffer(
  userId: string,
  dealAnalysisId: string,
  buyerName: string,
) {
  const { data, error } = await supabase
    .from("offers")
    .insert({
      user_id: userId,
      deal_analysis_id: dealAnalysisId,
      buyer_name: buyerName,
      labels: [],
      contingencies: [],
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

// ─── Document Upload ───

export async function uploadDocument(
  userId: string,
  offerId: string,
  file: File,
  category: string,
) {
  const filePath = `${userId}/${offerId}/${Date.now()}-${file.name}`;

  // Upload to storage
  const { error: uploadErr } = await supabase.storage
    .from("offer-documents")
    .upload(filePath, file);

  if (uploadErr) throw uploadErr;

  // Create document record
  const { data, error } = await supabase
    .from("documents")
    .insert({
      offer_id: offerId,
      user_id: userId,
      name: file.name,
      category,
      status: "pending",
      confidence: 0,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { documentId: data.id, filePath };
}

// ─── Trigger Extraction ───

export async function triggerExtraction(
  offerId: string,
  offerName: string,
  documents: { id: string; name: string; category: string }[],
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/extract-offer`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      offer_id: offerId,
      offer_name: offerName,
      documents,
    }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Extraction failed");
  return result;
}

// ─── Fetch Extracted Fields ───

export async function fetchExtractedFields(offerId: string) {
  const { data, error } = await supabase
    .from("extracted_offer_fields")
    .select("*")
    .eq("offer_id", offerId)
    .order("version", { ascending: false });

  if (error) throw error;
  return data;
}

// ─── Fetch Offers for a Deal Analysis ───

export async function fetchOffersForAnalysis(dealAnalysisId: string) {
  const { data, error } = await supabase
    .from("offers")
    .select("*, documents(*)")
    .eq("deal_analysis_id", dealAnalysisId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}