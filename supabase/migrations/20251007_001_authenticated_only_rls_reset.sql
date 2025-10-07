-- Simplify RLS: authenticated users can do all CRUD; unauthenticated denied
-- Applies to all main application tables and analytics caches

-- Helper: drop all existing policies for a given table
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'items','recipes','meal_logs',
        'daily_analytics_cache','weekly_analytics_cache','monthly_analytics_cache'
      )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END$$;

-- Enable RLS on all target tables
ALTER TABLE IF EXISTS items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS weekly_analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS monthly_analytics_cache ENABLE ROW LEVEL SECURITY;

-- Create unified authenticated-only policies
-- Using both USING and WITH CHECK so all CRUD is covered

CREATE POLICY "auth_all_items" ON items
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth_all_recipes" ON recipes
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth_all_meal_logs" ON meal_logs
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth_all_daily_analytics_cache" ON daily_analytics_cache
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth_all_weekly_analytics_cache" ON weekly_analytics_cache
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth_all_monthly_analytics_cache" ON monthly_analytics_cache
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Note: Service Role key bypasses RLS entirely (Supabase default), so background jobs/tools still work.
