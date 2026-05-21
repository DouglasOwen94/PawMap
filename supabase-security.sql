-- ════════════════════════════════════════════════════════════════════
-- PawMap Security Hardening
-- Run this in Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- PART 1: Lock down UPDATE/DELETE behind auth
-- ─────────────────────────────────────────────
-- Drop the wide-open policies that allow anyone to update/delete

DROP POLICY IF EXISTS "Admin can update venues" ON public.venues;
DROP POLICY IF EXISTS "Admin can delete venues" ON public.venues;
DROP POLICY IF EXISTS "Admin can manage community photos" ON public.community_photos;

-- Replace with auth-gated versions
-- (any signed-in user can manage; since you control who has an account, this is your admin gate)

CREATE POLICY "Authenticated can update venues"
  ON public.venues FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete venues"
  ON public.venues FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update community photos"
  ON public.community_photos FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete community photos"
  ON public.community_photos FOR DELETE
  TO authenticated
  USING (true);

-- Same protection for amenity_tags and change_reports
DROP POLICY IF EXISTS "Admin can manage amenity tags" ON public.amenity_tags;
DROP POLICY IF EXISTS "Admin can update change reports" ON public.change_reports;
DROP POLICY IF EXISTS "Admin can delete change reports" ON public.change_reports;

CREATE POLICY "Authenticated can manage amenity tags"
  ON public.amenity_tags FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can update change reports"
  ON public.change_reports FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete change reports"
  ON public.change_reports FOR DELETE
  TO authenticated
  USING (true);


-- ─────────────────────────────────────────────
-- PART 2: Rate limit public INSERTs
-- ─────────────────────────────────────────────
-- Blocks more than N inserts per hour from the same IP.
-- The IP comes from the request headers Supabase forwards.

CREATE OR REPLACE FUNCTION public.get_client_ip()
RETURNS TEXT AS $$
DECLARE
  headers JSON;
BEGIN
  BEGIN
    headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'unknown';
  END;
  RETURN COALESCE(
    split_part(headers->>'x-forwarded-for', ',', 1),
    headers->>'x-real-ip',
    'unknown'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- Venue submissions: max 5 per hour per IP
CREATE OR REPLACE FUNCTION public.rate_limit_venues()
RETURNS TRIGGER AS $$
DECLARE
  ip TEXT;
  recent_count INT;
BEGIN
  -- Skip rate limiting for authenticated users (admin)
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  ip := public.get_client_ip();
  IF ip = 'unknown' THEN
    RETURN NEW; -- Don't block when we can't identify
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM public.venues
  WHERE submitted_ip = ip
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Too many submissions. Please try again later.'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.submitted_ip := ip;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Change reports: max 10 per hour per IP
CREATE OR REPLACE FUNCTION public.rate_limit_change_reports()
RETURNS TRIGGER AS $$
DECLARE
  ip TEXT;
  recent_count INT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  ip := public.get_client_ip();
  IF ip = 'unknown' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM public.change_reports
  WHERE submitted_ip = ip
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Too many reports. Please try again later.'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.submitted_ip := ip;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Community photos: max 20 per hour per IP
CREATE OR REPLACE FUNCTION public.rate_limit_community_photos()
RETURNS TRIGGER AS $$
DECLARE
  ip TEXT;
  recent_count INT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  ip := public.get_client_ip();
  IF ip = 'unknown' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM public.community_photos
  WHERE submitted_ip = ip
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Too many uploads. Please try again later.'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.submitted_ip := ip;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Add submitted_ip columns (safe to re-run — IF NOT EXISTS)
ALTER TABLE public.venues          ADD COLUMN IF NOT EXISTS submitted_ip TEXT;
ALTER TABLE public.change_reports  ADD COLUMN IF NOT EXISTS submitted_ip TEXT;
ALTER TABLE public.community_photos ADD COLUMN IF NOT EXISTS submitted_ip TEXT;

-- Wire triggers (drop first so re-running is safe)
DROP TRIGGER IF EXISTS rate_limit_venues_trigger ON public.venues;
CREATE TRIGGER rate_limit_venues_trigger
  BEFORE INSERT ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.rate_limit_venues();

DROP TRIGGER IF EXISTS rate_limit_change_reports_trigger ON public.change_reports;
CREATE TRIGGER rate_limit_change_reports_trigger
  BEFORE INSERT ON public.change_reports
  FOR EACH ROW EXECUTE FUNCTION public.rate_limit_change_reports();

DROP TRIGGER IF EXISTS rate_limit_community_photos_trigger ON public.community_photos;
CREATE TRIGGER rate_limit_community_photos_trigger
  BEFORE INSERT ON public.community_photos
  FOR EACH ROW EXECUTE FUNCTION public.rate_limit_community_photos();

-- Done. Verify with:
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.venues'::regclass;
