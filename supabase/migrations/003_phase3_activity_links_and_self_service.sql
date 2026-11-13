-- CHUAN-DI Phase 3 Migration: Friend Self-Service, Activity Invitation Link Tracking & Authorization RLS

ALTER TABLE public.activity_invitations
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_friends_linked_user ON public.friends(linked_user_id);

-- Allow authenticated friends linked via registration invitations to view & update their own profile and interests
DROP POLICY IF EXISTS "Linked friends can view own friend record" ON public.friends;
CREATE POLICY "Linked friends can view own friend record" ON public.friends
  FOR SELECT USING (auth.uid() = linked_user_id);

DROP POLICY IF EXISTS "Linked friends can update own friend record" ON public.friends;
CREATE POLICY "Linked friends can update own friend record" ON public.friends
  FOR UPDATE USING (auth.uid() = linked_user_id);

DROP POLICY IF EXISTS "Linked friends can manage own interests" ON public.friend_interests;
CREATE POLICY "Linked friends can manage own interests" ON public.friend_interests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.friends f
      WHERE f.id = friend_interests.friend_id AND f.linked_user_id = auth.uid()
    )
  );

-- Allow invited linked friends to view their invitations & update their own RSVP
DROP POLICY IF EXISTS "Linked friends can view own activity invitations" ON public.activity_invitations;
CREATE POLICY "Linked friends can view own activity invitations" ON public.activity_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.friends f
      WHERE f.id = activity_invitations.friend_id AND f.linked_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked friends can update own RSVP" ON public.activity_invitations;
CREATE POLICY "Linked friends can update own RSVP" ON public.activity_invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.friends f
      WHERE f.id = activity_invitations.friend_id AND f.linked_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Invited linked friends can view invited activity" ON public.activities;
CREATE POLICY "Invited linked friends can view invited activity" ON public.activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.activity_invitations ai
      JOIN public.friends f ON f.id = ai.friend_id
      WHERE ai.activity_id = activities.id AND f.linked_user_id = auth.uid()
    )
  );
