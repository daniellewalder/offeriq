ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS extraction_error TEXT;

ALTER TABLE public.extracted_offer_fields
  ADD COLUMN IF NOT EXISTS source_document_id UUID,
  ADD COLUMN IF NOT EXISTS source_document_name TEXT;

CREATE INDEX IF NOT EXISTS idx_extracted_fields_offer_version
  ON public.extracted_offer_fields(offer_id, version DESC);