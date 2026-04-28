import { createClient } from "@supabase/supabase-js";
import type { ExtractionResult, OfferFile } from "../types/offer";

// ─── Supabase client ──────────────────────────────────────────────────────────
// These env vars are already in your Vite project from Lovable
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[offerExtraction] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — Edge Function calls will fail."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Core extraction call ─────────────────────────────────────────────────────

/**
 * Send a single PDF file to the extract-offer Edge Function.
 * Returns the full ExtractionResult from Claude.
 */
export async function extractOfferFromPDF(file: File): Promise<ExtractionResult> {
  const formData = new FormData();
  formData.append("pdf", file);

  const { data, error } = await supabase.functions.invoke("extract-offer", {
    body: formData,
  });

  if (error) {
    throw new Error(`Edge Function error: ${error.message}`);
  }

  if (!data.success) {
    throw new Error(data.error || "Extraction failed for unknown reason");
  }

  return data as ExtractionResult;
}

// ─── Batch extraction ─────────────────────────────────────────────────────────

export type ExtractionProgressCallback = (
  fileId: string,
  status: OfferFile["status"],
  result?: ExtractionResult,
  error?: string
) => void;

/**
 * Extract offers from multiple PDF files concurrently (max 3 at a time).
 * Calls onProgress with live status updates so the UI can update per-file.
 */
export async function extractOffersFromPDFs(
  files: File[],
  onProgress: ExtractionProgressCallback
): Promise<OfferFile[]> {
  const CONCURRENCY = 3;
  const results: OfferFile[] = files.map((file) => ({
    id: crypto.randomUUID(),
    file_name: file.name,
    file_size: file.size,
    status: "pending",
    extracted: null,
    uploaded_at: new Date().toISOString(),
  }));

  // Process in batches to avoid slamming the API
  for (let i = 0; i < results.length; i += CONCURRENCY) {
    const batch = results.slice(i, i + CONCURRENCY);
    const batchFiles = files.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (offerFile, batchIdx) => {
        const file = batchFiles[batchIdx];

        // Mark as extracting
        offerFile.status = "extracting";
        onProgress(offerFile.id, "extracting");

        try {
          const result = await extractOfferFromPDF(file);
          offerFile.status = "complete";
          offerFile.extracted = result.extracted;
          onProgress(offerFile.id, "complete", result);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          offerFile.status = "error";
          offerFile.error = message;
          onProgress(offerFile.id, "error", undefined, message);
        }
      })
    );
  }

  return results;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

export const SUPPORTED_MIME_TYPES = ["application/pdf"];
export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export interface FileValidationError {
  file: File;
  reason: string;
}

export function validatePDFFiles(files: File[]): {
  valid: File[];
  errors: FileValidationError[];
} {
  const valid: File[] = [];
  const errors: FileValidationError[] = [];

  for (const file of files) {
    if (!SUPPORTED_MIME_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
      errors.push({ file, reason: `${file.name} is not a PDF file` });
    } else if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push({
        file,
        reason: `${file.name} is too large (max ${MAX_FILE_SIZE_MB}MB)`,
      });
    } else {
      valid.push(file);
    }
  }

  return { valid, errors };
}
