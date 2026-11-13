-- CHUAN-DI (ชวนดิ!) — Complete Relational Schema for Supabase PostgreSQL + RLS
-- Note: Local zero-config runtime uses embedded Node.js SQLite (src/lib/db.ts) with matching structure.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  bio TEXT DEFAULT 'ผู้จัดทริปและรวบรวมความชอบเพื่อน ๆ',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.friends (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  linked_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  nickname TEXT NOT NULL,
  birthday DATE,
  contact_info TEXT,
  personal_notes TEXT,
  avatar_color TEXT NOT NULL DEFAULT '#FFE4EC',
  consent_given BOOLEAN NOT NULL DEFAULT TRUE,
  joined_via_invite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends(user_id);

CREATE TABLE IF NOT EXISTS public.interest_categories (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_th TEXT NOT NULL,
  name_en TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.interests (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES public.interest_categories(id) ON DELETE CASCADE,
  normalized_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category_id, normalized_value)
);

CREATE TABLE IF NOT EXISTS public.text_inputs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  source_label TEXT NOT NULL DEFAULT 'ป้อนข้อความด้วยตนเอง',
  extraction_mode TEXT NOT NULL DEFAULT 'rule_based_fallback',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.friend_interests (
  id BIGSERIAL PRIMARY KEY,
  friend_id BIGINT NOT NULL REFERENCES public.friends(id) ON DELETE CASCADE,
  interest_id BIGINT NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
  raw_value TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  text_input_id BIGINT REFERENCES public.text_inputs(id) ON DELETE SET NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  confirmed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(friend_id, interest_id)
);

CREATE TABLE IF NOT EXISTS public.extracted_data (
  id BIGSERIAL PRIMARY KEY,
  text_input_id BIGINT NOT NULL REFERENCES public.text_inputs(id) ON DELETE CASCADE,
  friend_id BIGINT REFERENCES public.friends(id) ON DELETE SET NULL,
  detected_friend_name TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  raw_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  confirmation_status TEXT NOT NULL DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'confirmed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activities (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  activity_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  location TEXT NOT NULL,
  target_interests_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activity_participants (
  id BIGSERIAL PRIMARY KEY,
  activity_id BIGINT NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  friend_id BIGINT NOT NULL REFERENCES public.friends(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'guest',
  UNIQUE(activity_id, friend_id)
);

CREATE TABLE IF NOT EXISTS public.activity_invitations (
  id BIGSERIAL PRIMARY KEY,
  activity_id BIGINT NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  friend_id BIGINT NOT NULL REFERENCES public.friends(id) ON DELETE CASCADE,
  invite_token TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(activity_id, friend_id)
);

CREATE TABLE IF NOT EXISTS public.rsvp_responses (
  id BIGSERIAL PRIMARY KEY,
  invitation_id BIGINT NOT NULL UNIQUE REFERENCES public.activity_invitations(id) ON DELETE CASCADE,
  rsvp_status TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'going', 'not_going')),
  decline_reason TEXT,
  response_note TEXT,
  responded_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.registration_invitations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_token TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  target_friend_name TEXT,
  prefill_friend_id BIGINT REFERENCES public.friends(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  accepted_friend_id BIGINT REFERENCES public.friends(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.text_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_invitations ENABLE ROW LEVEL SECURITY;

-- Ownership Policies
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users manage own friends" ON public.friends
  FOR ALL USING (auth.uid() = user_id OR auth.uid() = linked_user_id);

CREATE POLICY "Users manage own text inputs" ON public.text_inputs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own friend interests" ON public.friend_interests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.friends f WHERE f.id = friend_id AND f.user_id = auth.uid())
  );

CREATE POLICY "Users manage own activities" ON public.activities
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own activity invitations" ON public.activity_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.activities a WHERE a.id = activity_id AND a.user_id = auth.uid())
  );

CREATE POLICY "Users manage own registration invitations" ON public.registration_invitations
  FOR ALL USING (auth.uid() = user_id);
