CREATE TABLE public.email_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signup',
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_otp_lookup
  ON public.email_otp_challenges(email, purpose, created_at DESC);

CREATE INDEX idx_email_otp_expires
  ON public.email_otp_challenges(expires_at);

ALTER TABLE public.email_otp_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_otp_challenges_no_access ON public.email_otp_challenges;
CREATE POLICY email_otp_challenges_no_access ON public.email_otp_challenges
  FOR ALL USING (false) WITH CHECK (false);
