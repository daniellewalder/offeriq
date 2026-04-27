ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS counters jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS counter_status text NOT NULL DEFAULT 'none';