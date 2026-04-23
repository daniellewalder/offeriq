
-- ============================================
-- Core tables for the real estate offer platform
-- ============================================

-- 1. Properties
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  listing_price NUMERIC,
  property_type TEXT DEFAULT 'Single Family',
  status TEXT DEFAULT 'Active',
  seller_notes TEXT,
  seller_goals TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Deal Analyses (a "session" of analysis for a property)
CREATE TABLE public.deal_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'New Analysis',
  status TEXT DEFAULT 'in_progress',
  top_recommendation TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Offers (belong to a deal analysis)
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_analysis_id UUID REFERENCES public.deal_analyses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  buyer_name TEXT NOT NULL,
  agent_name TEXT,
  agent_brokerage TEXT,
  offer_price NUMERIC,
  financing_type TEXT,
  down_payment NUMERIC,
  down_payment_percent NUMERIC,
  earnest_money NUMERIC,
  contingencies TEXT[] DEFAULT '{}',
  inspection_period TEXT,
  appraisal_terms TEXT,
  close_timeline TEXT,
  close_days INTEGER,
  leaseback_request TEXT DEFAULT 'None',
  concessions TEXT DEFAULT 'None',
  proof_of_funds BOOLEAN DEFAULT false,
  pre_approval BOOLEAN DEFAULT false,
  completeness INTEGER DEFAULT 0,
  special_notes TEXT,
  labels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Documents (belong to an offer)
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  confidence NUMERIC DEFAULT 0,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Extracted Offer Fields (AI extraction results, versioned)
CREATE TABLE public.extracted_offer_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE NOT NULL,
  version INTEGER DEFAULT 1,
  field_name TEXT NOT NULL,
  field_value JSONB,
  confidence NUMERIC DEFAULT 0,
  evidence TEXT,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Seller Priorities (per deal analysis)
CREATE TABLE public.seller_priorities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_analysis_id UUID REFERENCES public.deal_analyses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  price_weight INTEGER DEFAULT 80,
  certainty_weight INTEGER DEFAULT 70,
  contingencies_weight INTEGER DEFAULT 60,
  speed_weight INTEGER DEFAULT 50,
  leaseback_weight INTEGER DEFAULT 30,
  repair_weight INTEGER DEFAULT 40,
  financial_weight INTEGER DEFAULT 65,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Risk Scores (per offer, versioned for history)
CREATE TABLE public.risk_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE NOT NULL,
  version INTEGER DEFAULT 1,
  offer_strength INTEGER,
  close_probability INTEGER,
  financial_confidence INTEGER,
  contingency_risk INTEGER,
  timing_risk INTEGER,
  package_completeness INTEGER,
  factor_details JSONB,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Leverage Suggestions (per deal analysis, versioned)
CREATE TABLE public.leverage_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_analysis_id UUID REFERENCES public.deal_analyses(id) ON DELETE CASCADE NOT NULL,
  version INTEGER DEFAULT 1,
  suggestions JSONB NOT NULL DEFAULT '[]',
  easiest_wins JSONB DEFAULT '[]',
  highest_impact_terms JSONB DEFAULT '[]',
  notes TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Counter Strategies (per deal analysis, versioned)
CREATE TABLE public.counter_strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_analysis_id UUID REFERENCES public.deal_analyses(id) ON DELETE CASCADE NOT NULL,
  version INTEGER DEFAULT 1,
  strategy_type TEXT NOT NULL,
  target_buyer TEXT,
  counter_price NUMERIC,
  acceptance_likelihood INTEGER,
  terms JSONB DEFAULT '{}',
  rationale TEXT,
  risk TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Activity Logs
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  deal_analysis_id UUID REFERENCES public.deal_analyses(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Enable RLS on all tables
-- ============================================
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_offer_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leverage_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counter_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies — owner-scoped access
-- ============================================

-- Properties: owner can CRUD
CREATE POLICY "Users manage own properties" ON public.properties
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Deal Analyses: owner can CRUD
CREATE POLICY "Users manage own deal analyses" ON public.deal_analyses
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Offers: owner can CRUD
CREATE POLICY "Users manage own offers" ON public.offers
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Documents: owner can CRUD
CREATE POLICY "Users manage own documents" ON public.documents
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Extracted fields: accessible if user owns the parent offer
CREATE POLICY "Users view own extracted fields" ON public.extracted_offer_fields
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.offers WHERE offers.id = extracted_offer_fields.offer_id AND offers.user_id = auth.uid())
  );
CREATE POLICY "Users insert own extracted fields" ON public.extracted_offer_fields
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.offers WHERE offers.id = extracted_offer_fields.offer_id AND offers.user_id = auth.uid())
  );

-- Seller Priorities: owner can CRUD
CREATE POLICY "Users manage own seller priorities" ON public.seller_priorities
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Risk Scores: accessible if user owns the parent offer
CREATE POLICY "Users view own risk scores" ON public.risk_scores
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.offers WHERE offers.id = risk_scores.offer_id AND offers.user_id = auth.uid())
  );
CREATE POLICY "Users insert own risk scores" ON public.risk_scores
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.offers WHERE offers.id = risk_scores.offer_id AND offers.user_id = auth.uid())
  );

-- Leverage Suggestions: accessible if user owns the parent deal analysis
CREATE POLICY "Users view own leverage suggestions" ON public.leverage_suggestions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.deal_analyses WHERE deal_analyses.id = leverage_suggestions.deal_analysis_id AND deal_analyses.user_id = auth.uid())
  );
CREATE POLICY "Users insert own leverage suggestions" ON public.leverage_suggestions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.deal_analyses WHERE deal_analyses.id = leverage_suggestions.deal_analysis_id AND deal_analyses.user_id = auth.uid())
  );

-- Counter Strategies: accessible if user owns the parent deal analysis
CREATE POLICY "Users view own counter strategies" ON public.counter_strategies
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.deal_analyses WHERE deal_analyses.id = counter_strategies.deal_analysis_id AND deal_analyses.user_id = auth.uid())
  );
CREATE POLICY "Users insert own counter strategies" ON public.counter_strategies
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.deal_analyses WHERE deal_analyses.id = counter_strategies.deal_analysis_id AND deal_analyses.user_id = auth.uid())
  );

-- Activity Logs: owner can read and insert
CREATE POLICY "Users view own activity logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own activity logs" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============================================
-- Indexes for common queries
-- ============================================
CREATE INDEX idx_deal_analyses_property ON public.deal_analyses(property_id);
CREATE INDEX idx_offers_deal_analysis ON public.offers(deal_analysis_id);
CREATE INDEX idx_documents_offer ON public.documents(offer_id);
CREATE INDEX idx_extracted_fields_offer ON public.extracted_offer_fields(offer_id);
CREATE INDEX idx_risk_scores_offer ON public.risk_scores(offer_id);
CREATE INDEX idx_leverage_deal ON public.leverage_suggestions(deal_analysis_id);
CREATE INDEX idx_counter_deal ON public.counter_strategies(deal_analysis_id);
CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_deal ON public.activity_logs(deal_analysis_id);
