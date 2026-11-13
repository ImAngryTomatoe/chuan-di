-- CHUAN-DI Phase 2 Migration: Traceability Enrichment & Saved Segments

ALTER TABLE public.text_inputs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_review';

ALTER TABLE public.extracted_data
  ADD COLUMN IF NOT EXISTS confidence REAL NOT NULL DEFAULT 0.9,
  ADD COLUMN IF NOT EXISTS is_ambiguous BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS uncertainty_reason TEXT,
  ADD COLUMN IF NOT EXISTS restriction_type TEXT;

ALTER TABLE public.friend_interests
  ADD COLUMN IF NOT EXISTS restriction_type TEXT;

CREATE TABLE IF NOT EXISTS public.saved_segments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  include_interests_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclude_interests_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  category_filter TEXT NOT NULL DEFAULT '',
  match_mode TEXT NOT NULL DEFAULT 'all' CHECK (match_mode IN ('all', 'any')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_segments_user ON public.saved_segments(user_id);

ALTER TABLE public.saved_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved segments" ON public.saved_segments
  FOR ALL USING (auth.uid() = user_id);
