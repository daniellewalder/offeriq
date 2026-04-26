import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExtractionField {
  field_name: string;
  field_value: any;
  confidence: number;
  evidence: string | null;
}

// Simulated extraction based on document categories present
function generateMockExtraction(
  documents: { name: string; category: string }[],
  offerName: string,
): ExtractionField[] {
  const categories = documents.map((d) => d.category);
  const hasPurchaseAgreement = categories.includes("Purchase Agreement");
  const hasProofOfFunds = categories.includes("Proof of Funds");
  const hasPreApproval = categories.includes("Pre-Approval");
  const hasProofOfIncome = categories.includes("Proof of Income");
  const hasAddenda = categories.includes("Addenda");
  const hasDisclosures = categories.includes("Disclosures");

  // Generate a realistic price based on name hash
  const hash = offerName.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const basePrice = 800000 + (hash % 40) * 50000;
  const downPct = [15, 20, 25, 30, 100][hash % 5];
  const isCash = downPct === 100;
  const closeDays = [14, 21, 28, 30, 45][hash % 5];
  const inspDays = [5, 7, 10, 14, 17][hash % 5];
  const earnestPct = 1.5 + (hash % 3) * 0.5;
  const earnestMoney = Math.round(basePrice * (earnestPct / 100));

  const fields: ExtractionField[] = [];

  // Core terms — always attempted
  fields.push({
    field_name: "buyer_name",
    field_value: offerName,
    confidence: hasPurchaseAgreement ? 0.97 : 0.4,
    evidence: hasPurchaseAgreement
      ? `Buyer: ${offerName}, as identified in the purchase agreement`
      : null,
  });

  fields.push({
    field_name: "offer_price",
    field_value: basePrice,
    confidence: hasPurchaseAgreement ? 0.99 : 0.0,
    evidence: hasPurchaseAgreement
      ? `Purchase Price: $${basePrice.toLocaleString()}`
      : null,
  });

  fields.push({
    field_name: "financing_type",
    field_value: isCash
      ? "All Cash"
      : `Conventional — ${downPct}% Down`,
    confidence: hasPurchaseAgreement ? 0.95 : 0.0,
    evidence: hasPurchaseAgreement
      ? isCash
        ? "All-cash purchase, no financing contingency"
        : `Conventional mortgage, ${100 - downPct}% LTV`
      : null,
  });

  if (!isCash) {
    const loanAmt = Math.round(basePrice * ((100 - downPct) / 100));
    fields.push({
      field_name: "loan_amount",
      field_value: loanAmt,
      confidence: hasPurchaseAgreement ? 0.93 : 0.0,
      evidence: hasPurchaseAgreement
        ? `Loan amount shall not exceed $${loanAmt.toLocaleString()}`
        : null,
    });
  }

  const downAmt = Math.round(basePrice * (downPct / 100));
  fields.push({
    field_name: "down_payment_amount",
    field_value: downAmt,
    confidence: hasPurchaseAgreement ? 0.94 : 0.0,
    evidence: hasPurchaseAgreement
      ? `Down payment of $${downAmt.toLocaleString()} (${downPct}% of purchase price)`
      : null,
  });

  fields.push({
    field_name: "down_payment_percent",
    field_value: downPct,
    confidence: hasPurchaseAgreement ? 0.96 : 0.0,
    evidence: hasPurchaseAgreement
      ? `Down payment: ${downPct}%`
      : null,
  });

  fields.push({
    field_name: "earnest_money_deposit",
    field_value: earnestMoney,
    confidence: hasPurchaseAgreement ? 0.97 : 0.0,
    evidence: hasPurchaseAgreement
      ? `Initial deposit of $${earnestMoney.toLocaleString()} within 3 business days`
      : null,
  });

  // Timeline
  fields.push({
    field_name: "close_of_escrow_days",
    field_value: closeDays,
    confidence: hasPurchaseAgreement ? 0.96 : 0.0,
    evidence: hasPurchaseAgreement
      ? `Close of escrow shall be ${closeDays} days after acceptance`
      : null,
  });

  // Contingencies
  const hasInspection = inspDays <= 14;
  fields.push({
    field_name: "inspection_contingency_present",
    field_value: true,
    confidence: hasPurchaseAgreement ? 0.98 : 0.0,
    evidence: hasPurchaseAgreement
      ? `Buyer shall have the right to conduct inspections within ${inspDays} days`
      : null,
  });

  fields.push({
    field_name: "inspection_contingency_days",
    field_value: inspDays,
    confidence: hasPurchaseAgreement ? 0.97 : 0.0,
    evidence: hasPurchaseAgreement
      ? `Inspection period of ${inspDays} calendar days`
      : null,
  });

  if (!isCash) {
    fields.push({
      field_name: "appraisal_contingency_present",
      field_value: true,
      confidence: hasPurchaseAgreement ? 0.92 : 0.0,
      evidence: hasPurchaseAgreement
        ? "Offer is contingent upon the property appraising at or above the purchase price"
        : null,
    });

    fields.push({
      field_name: "loan_contingency_present",
      field_value: true,
      confidence: hasPurchaseAgreement ? 0.91 : 0.0,
      evidence: hasPurchaseAgreement
        ? `Loan contingency period: ${closeDays - 9} days from acceptance`
        : null,
    });
  }

  // Leaseback — random based on hash
  const wantsLeaseback = hash % 3 === 0;
  const leasebackDays = wantsLeaseback ? [7, 14, 30][hash % 3] : 0;
  fields.push({
    field_name: "leaseback_requested",
    field_value: wantsLeaseback,
    confidence: hasPurchaseAgreement ? 0.85 : 0.0,
    evidence: wantsLeaseback && hasPurchaseAgreement
      ? `Seller may occupy the property for up to ${leasebackDays} days after close`
      : null,
  });

  if (wantsLeaseback) {
    fields.push({
      field_name: "leaseback_days",
      field_value: leasebackDays,
      confidence: hasPurchaseAgreement ? 0.84 : 0.0,
      evidence: hasPurchaseAgreement
        ? `Up to ${leasebackDays} days after close`
        : null,
    });
  }

  // Documentation fields
  fields.push({
    field_name: "proof_of_funds_present",
    field_value: hasProofOfFunds,
    confidence: hasProofOfFunds ? 0.96 : 0.1,
    evidence: hasProofOfFunds
      ? "Proof of funds document attached and verified"
      : null,
  });

  fields.push({
    field_name: "preapproval_present",
    field_value: hasPreApproval,
    confidence: hasPreApproval ? 0.95 : 0.1,
    evidence: hasPreApproval
      ? "Pre-approval letter attached"
      : null,
  });

  fields.push({
    field_name: "proof_of_income_present",
    field_value: hasProofOfIncome,
    confidence: hasProofOfIncome ? 0.91 : 0.1,
    evidence: hasProofOfIncome
      ? "Income documentation provided"
      : null,
  });

  fields.push({
    field_name: "addenda_present",
    field_value: hasAddenda,
    confidence: hasAddenda ? 0.87 : 0.1,
    evidence: hasAddenda ? "Addenda documents present" : null,
  });

  fields.push({
    field_name: "disclosure_acknowledgment_present",
    field_value: hasDisclosures,
    confidence: hasDisclosures ? 0.82 : 0.1,
    evidence: hasDisclosures
      ? "Buyer acknowledges receipt of Transfer Disclosure Statement"
      : null,
  });

  // Computed summary fields
  const totalFields = fields.length;
  const foundFields = fields.filter((f) => f.field_value !== null && f.confidence > 0.5).length;
  const completeness = Math.round((foundFields / totalFields) * 100);

  const missingItems: string[] = [];
  if (!hasProofOfFunds) missingItems.push("Proof of funds not provided");
  if (!hasPreApproval && !isCash) missingItems.push("Pre-approval letter missing");
  if (!hasPurchaseAgreement) missingItems.push("Purchase agreement not found");
  if (!hasProofOfIncome) missingItems.push("No income documentation");

  const notableRisks: string[] = [];
  if (!isCash && !hasPreApproval) notableRisks.push("Financed offer without pre-approval increases uncertainty");
  if (inspDays > 14) notableRisks.push(`Extended ${inspDays}-day inspection period increases renegotiation risk`);
  if (closeDays > 35) notableRisks.push(`${closeDays}-day close creates extended market exposure`);
  if (!isCash) notableRisks.push("Active contingencies increase fall-through risk");

  const notableStrengths: string[] = [];
  if (isCash) notableStrengths.push("All-cash offer eliminates financing risk");
  if (hasProofOfFunds) notableStrengths.push("Verified proof of funds on file");
  if (hasPreApproval) notableStrengths.push("Lender pre-approval confirmed");
  if (completeness >= 90) notableStrengths.push("Comprehensive documentation package");
  if (closeDays <= 21) notableStrengths.push("Fast close timeline demonstrates urgency");

  fields.push({
    field_name: "package_completeness",
    field_value: `${completeness}%`,
    confidence: 0.9,
    evidence: null,
  });

  fields.push({
    field_name: "missing_items",
    field_value: missingItems,
    confidence: 0.85,
    evidence: null,
  });

  fields.push({
    field_name: "notable_risks",
    field_value: notableRisks,
    confidence: 0.88,
    evidence: null,
  });

  fields.push({
    field_name: "notable_strengths",
    field_value: notableStrengths,
    confidence: 0.92,
    evidence: null,
  });

  return fields;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { offer_id, offer_name, documents } = body;

    if (!offer_id || !offer_name || !documents || !Array.isArray(documents)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: offer_id, offer_name, documents" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify the offer belongs to this user
    const { data: offer, error: offerErr } = await supabase
      .from("offers")
      .select("id, user_id")
      .eq("id", offer_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (offerErr || !offer) {
      return new Response(
        JSON.stringify({ error: "Offer not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get the next version number
    const { data: existingFields } = await supabase
      .from("extracted_offer_fields")
      .select("version")
      .eq("offer_id", offer_id)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = existingFields && existingFields.length > 0
      ? (existingFields[0].version ?? 0) + 1
      : 1;

    // Generate mock extraction
    const extractedFields = generateMockExtraction(documents, offer_name);

    // Store extracted fields
    const rows = extractedFields.map((f) => ({
      offer_id,
      field_name: f.field_name,
      field_value: f.field_value,
      confidence: f.confidence,
      evidence: f.evidence,
      version: nextVersion,
    }));

    const { error: insertErr } = await supabase
      .from("extracted_offer_fields")
      .insert(rows);

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to store extraction results", detail: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update offer with key extracted values
    const fieldMap: Record<string, any> = {};
    for (const f of extractedFields) {
      fieldMap[f.field_name] = f.field_value;
    }

    const offerUpdate: Record<string, any> = {
      offer_price: fieldMap.offer_price ?? null,
      financing_type: fieldMap.financing_type ?? null,
      down_payment: fieldMap.down_payment_amount ?? null,
      down_payment_percent: fieldMap.down_payment_percent ?? null,
      earnest_money: fieldMap.earnest_money_deposit ?? null,
      close_days: fieldMap.close_of_escrow_days ?? null,
      close_timeline: fieldMap.close_of_escrow_days
        ? `${fieldMap.close_of_escrow_days} days`
        : null,
      inspection_period: fieldMap.inspection_contingency_days
        ? `${fieldMap.inspection_contingency_days} days`
        : null,
      leaseback_request: fieldMap.leaseback_requested
        ? `${fieldMap.leaseback_days ?? 0}-day rent-free leaseback`
        : "None",
      proof_of_funds: fieldMap.proof_of_funds_present ?? false,
      pre_approval: fieldMap.preapproval_present ?? false,
      completeness: parseInt(String(fieldMap.package_completeness ?? "0")),
      updated_at: new Date().toISOString(),
    };

    // Build contingencies array
    const contingencies: string[] = [];
    if (fieldMap.inspection_contingency_present) {
      contingencies.push(`Inspection (${fieldMap.inspection_contingency_days} days)`);
    }
    if (fieldMap.appraisal_contingency_present) {
      contingencies.push("Appraisal");
    }
    if (fieldMap.loan_contingency_present) {
      contingencies.push("Loan");
    }
    offerUpdate.contingencies = contingencies;

    const { error: updateErr } = await supabase
      .from("offers")
      .update(offerUpdate)
      .eq("id", offer_id);

    if (updateErr) {
      console.error("Offer update error:", updateErr);
    }

    // Update document statuses
    for (const doc of documents) {
      if (doc.id) {
        await supabase
          .from("documents")
          .update({
            status: "verified",
            confidence: Math.round(70 + Math.random() * 28),
          })
          .eq("id", doc.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: nextVersion,
        fields_count: extractedFields.length,
        extraction: extractedFields,
        missing_items: fieldMap.missing_items ?? [],
        notable_risks: fieldMap.notable_risks ?? [],
        notable_strengths: fieldMap.notable_strengths ?? [],
        completeness: fieldMap.package_completeness ?? "0%",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("Extraction error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});