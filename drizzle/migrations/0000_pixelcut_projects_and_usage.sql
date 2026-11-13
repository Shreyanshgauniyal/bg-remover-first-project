CREATE TABLE public.pixelcut_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  filename text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  original_path text NOT NULL,
  processed_path text NOT NULL,
  width integer NOT NULL DEFAULT 0,
  height integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pixelcut_projects TO authenticated;
GRANT ALL ON public.pixelcut_projects TO service_role;

ALTER TABLE public.pixelcut_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pixelcut projects" ON public.pixelcut_projects
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own pixelcut projects" ON public.pixelcut_projects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pixelcut projects" ON public.pixelcut_projects
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own pixelcut projects" ON public.pixelcut_projects
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX pixelcut_projects_user_created_idx ON public.pixelcut_projects (user_id, created_at DESC);

-- Usage is written only by the server (service role); users may read their own row.
CREATE TABLE public.pixelcut_usage (
  user_id uuid PRIMARY KEY,
  images_processed integer NOT NULL DEFAULT 0,
  used_this_period integer NOT NULL DEFAULT 0,
  monthly_limit integer NOT NULL DEFAULT 20,
  period_start date NOT NULL DEFAULT (date_trunc('month', now()))::date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pixelcut_usage TO authenticated;
GRANT ALL ON public.pixelcut_usage TO service_role;

ALTER TABLE public.pixelcut_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pixelcut usage" ON public.pixelcut_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.pixelcut_consume_credit(_user_id uuid)
RETURNS TABLE (allowed boolean, remaining integer, monthly_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.pixelcut_usage;
  this_month date := (date_trunc('month', now()))::date;
BEGIN
  INSERT INTO public.pixelcut_usage (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO r FROM public.pixelcut_usage u WHERE u.user_id = _user_id FOR UPDATE;
  IF r.period_start < this_month THEN
    UPDATE public.pixelcut_usage u SET used_this_period = 0, period_start = this_month, updated_at = now()
      WHERE u.user_id = _user_id;
    r.used_this_period := 0;
  END IF;
  IF r.used_this_period >= r.monthly_limit THEN
    RETURN QUERY SELECT false, 0, r.monthly_limit;
    RETURN;
  END IF;
  UPDATE public.pixelcut_usage u
    SET used_this_period = u.used_this_period + 1,
        images_processed = u.images_processed + 1,
        updated_at = now()
    WHERE u.user_id = _user_id;
  RETURN QUERY SELECT true, r.monthly_limit - r.used_this_period - 1, r.monthly_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.pixelcut_refund_credit(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.pixelcut_usage
    SET used_this_period = GREATEST(used_this_period - 1, 0),
        images_processed = GREATEST(images_processed - 1, 0),
        updated_at = now()
    WHERE user_id = _user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.pixelcut_consume_credit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pixelcut_refund_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pixelcut_consume_credit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pixelcut_refund_credit(uuid) TO service_role;

-- Read-only view of the caller's own usage, with monthly reset applied.
CREATE OR REPLACE FUNCTION public.get_my_pixelcut_usage()
RETURNS TABLE (images_processed integer, used_this_period integer, monthly_limit integer, remaining integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH defaults AS (
    SELECT 20 AS lim
  ), u AS (
    SELECT * FROM public.pixelcut_usage WHERE user_id = auth.uid()
  )
  SELECT
    COALESCE((SELECT u.images_processed FROM u), 0),
    COALESCE((SELECT CASE WHEN u.period_start < (date_trunc('month', now()))::date THEN 0 ELSE u.used_this_period END FROM u), 0),
    COALESCE((SELECT u.monthly_limit FROM u), (SELECT lim FROM defaults)),
    COALESCE((SELECT u.monthly_limit FROM u), (SELECT lim FROM defaults))
      - COALESCE((SELECT CASE WHEN u.period_start < (date_trunc('month', now()))::date THEN 0 ELSE u.used_this_period END FROM u), 0)
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_pixelcut_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_pixelcut_usage() TO authenticated;

-- Storage: each user owns files under a folder named after their user id.
CREATE POLICY "PixelCut users read own files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pixelcut' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "PixelCut users upload own files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pixelcut' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "PixelCut users delete own files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pixelcut' AND (storage.foldername(name))[1] = auth.uid()::text);