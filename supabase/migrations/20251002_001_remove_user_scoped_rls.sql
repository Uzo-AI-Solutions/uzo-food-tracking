-- ============================================================================
-- Migration: Remove User-Scoped RLS and Enable System-Wide Data Access
-- Date: 2025-10-02
-- Description:
--   - Convert from per-user RLS to authenticated-only RLS
--   - Update analytics system to aggregate all user data
--   - Backfill analytics cache with system-wide aggregates
--
-- Security Model:
--   1. Web UI (ANON key) → Must authenticate, sees all data after auth
--   2. API Access (Service Role) → Bypasses RLS entirely for ChatGPT/tools
--   3. No public access → ANON key without authentication = denied
-- ============================================================================

-- ============================================================================
-- PART 1: Update RLS Policies
-- ============================================================================

-- Drop all existing user-scoped policies from main tables
DROP POLICY IF EXISTS "Allow anon and owner access to items" ON items;
DROP POLICY IF EXISTS "Allow anon and owner insert to items" ON items;
DROP POLICY IF EXISTS "Allow anon and owner access to recipes" ON recipes;
DROP POLICY IF EXISTS "Allow anon and owner insert to recipes" ON recipes;
DROP POLICY IF EXISTS "Allow anon and owner access to meal_logs" ON meal_logs;
DROP POLICY IF EXISTS "Allow anon and owner insert to meal_logs" ON meal_logs;

-- Drop old policies from analytics cache tables
DROP POLICY IF EXISTS "Allow anon and owner access to daily_analytics_cache" ON daily_analytics_cache;
DROP POLICY IF EXISTS "Allow anon and owner access to weekly_analytics_cache" ON weekly_analytics_cache;
DROP POLICY IF EXISTS "Allow anon and owner access to monthly_analytics_cache" ON monthly_analytics_cache;
DROP POLICY IF EXISTS "Users can view their own daily analytics" ON daily_analytics_cache;
DROP POLICY IF EXISTS "Users can view their own weekly analytics" ON weekly_analytics_cache;
DROP POLICY IF EXISTS "Users can view their own monthly analytics" ON monthly_analytics_cache;

-- Drop any old-style anon policies that might still exist
DROP POLICY IF EXISTS "anon_insert_items" ON items;
DROP POLICY IF EXISTS "anon_read_items" ON items;
DROP POLICY IF EXISTS "anon_update_items" ON items;
DROP POLICY IF EXISTS "anon_insert_recipes" ON recipes;
DROP POLICY IF EXISTS "anon_read_recipes" ON recipes;
DROP POLICY IF EXISTS "anon_update_recipes" ON recipes;
DROP POLICY IF EXISTS "anon_insert_meal_logs" ON meal_logs;
DROP POLICY IF EXISTS "anon_read_meal_logs" ON meal_logs;
DROP POLICY IF EXISTS "anon_update_meal_logs" ON meal_logs;
DROP POLICY IF EXISTS "anon_read_daily_analytics" ON daily_analytics_cache;
DROP POLICY IF EXISTS "anon_read_weekly_analytics" ON weekly_analytics_cache;
DROP POLICY IF EXISTS "anon_read_monthly_analytics" ON monthly_analytics_cache;

-- Create new policies: Authenticated users see all data
-- Service Role key automatically bypasses RLS (Supabase built-in behavior)
--
-- Access scenarios:
-- ✅ Authenticated user (web UI) → Sees all data
-- ✅ Service Role key (ChatGPT API) → Bypasses RLS, sees all data
-- ❌ ANON key without auth → Denied
-- ❌ Random person with ANON key → Must authenticate first

-- Main tables: items, recipes, meal_logs
CREATE POLICY "Allow authenticated access to items" ON items
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated access to recipes" ON recipes
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated access to meal_logs" ON meal_logs
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Analytics cache tables
CREATE POLICY "Allow authenticated access to daily_analytics_cache" ON daily_analytics_cache
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated access to weekly_analytics_cache" ON weekly_analytics_cache
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated access to monthly_analytics_cache" ON monthly_analytics_cache
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Note: user_id columns are kept in the database for potential future use
-- Authenticated users can see all data regardless of user_id value
--
-- For API access (ChatGPT/external tools):
-- Use the Service Role key which bypasses RLS entirely
-- Never expose the Service Role key in client-side code
-- Store it in ChatGPT custom GPT secrets or server environment variables


-- ============================================================================
-- PART 2: Update Analytics Schema for System-Wide Aggregation
-- ============================================================================

-- Remove foreign key constraints from analytics cache tables
ALTER TABLE daily_analytics_cache DROP CONSTRAINT IF EXISTS daily_analytics_cache_user_id_fkey;
ALTER TABLE weekly_analytics_cache DROP CONSTRAINT IF EXISTS weekly_analytics_cache_user_id_fkey;
ALTER TABLE monthly_analytics_cache DROP CONSTRAINT IF EXISTS monthly_analytics_cache_user_id_fkey;

-- Drop existing primary keys (they include user_id which we want to make nullable)
ALTER TABLE daily_analytics_cache DROP CONSTRAINT IF EXISTS daily_analytics_cache_pkey;
ALTER TABLE weekly_analytics_cache DROP CONSTRAINT IF EXISTS weekly_analytics_cache_pkey;
ALTER TABLE monthly_analytics_cache DROP CONSTRAINT IF EXISTS monthly_analytics_cache_pkey;

-- Make user_id nullable to support system-wide aggregation
ALTER TABLE daily_analytics_cache ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE weekly_analytics_cache ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE monthly_analytics_cache ALTER COLUMN user_id DROP NOT NULL;

-- Recreate primary keys with nullable user_id using UNIQUE constraints that treat NULLs as not distinct
-- This ensures a single "system-wide" row (user_id NULL) per date/week/month can be upserted via ON CONFLICT (user_id, ...)
-- Drop any legacy expression indexes if they exist
DROP INDEX IF EXISTS daily_analytics_cache_pkey_idx;
DROP INDEX IF EXISTS weekly_analytics_cache_pkey_idx;
DROP INDEX IF EXISTS monthly_analytics_cache_pkey_idx;

-- Add UNIQUE constraints with NULLS NOT DISTINCT so NULL user_id participates in uniqueness
ALTER TABLE daily_analytics_cache
  ADD CONSTRAINT daily_analytics_cache_unique UNIQUE NULLS NOT DISTINCT (user_id, date);
ALTER TABLE weekly_analytics_cache
  ADD CONSTRAINT weekly_analytics_cache_unique UNIQUE NULLS NOT DISTINCT (user_id, week_start);
ALTER TABLE monthly_analytics_cache
  ADD CONSTRAINT monthly_analytics_cache_unique UNIQUE NULLS NOT DISTINCT (user_id, month_start);


-- ============================================================================
-- PART 3: Update RPC Functions and Triggers
-- ============================================================================

-- Drop old function versions that might conflict
DROP FUNCTION IF EXISTS get_analytics_data(integer);

-- Update get_analytics_data RPC to aggregate ALL data (not user-specific)
CREATE OR REPLACE FUNCTION get_analytics_data(p_days_back INTEGER DEFAULT NULL, p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  date_filter_condition TEXT;
BEGIN
  -- Ignore p_user_id parameter - always aggregate all data
  -- This allows analytics to show system-wide statistics

  -- Build date filter condition only if p_days_back is provided
  IF p_days_back IS NOT NULL THEN
    date_filter_condition := ' WHERE date >= CURRENT_DATE - INTERVAL ''' || (p_days_back - 1) || ' days''';
  ELSE
    date_filter_condition := '';
  END IF;

  -- Build simplified analytics JSON aggregating ALL data across all users
  EXECUTE 'SELECT jsonb_build_object(
    ''daily_averages'', (
      SELECT jsonb_build_object(
        ''calories'', COALESCE(ROUND(AVG(calories), 0), 0),
        ''protein'', COALESCE(ROUND(AVG(protein), 0), 0),
        ''carbs'', COALESCE(ROUND(AVG(carbs), 0), 0),
        ''fat'', COALESCE(ROUND(AVG(fat), 0), 0),
        ''days_count'', COUNT(*)
      )
      FROM daily_analytics_cache
      ' || date_filter_condition || '
    ),

    ''weekly_averages'', (
      SELECT jsonb_build_object(
        ''calories'', COALESCE(ROUND(AVG(avg_calories), 0), 0),
        ''protein'', COALESCE(ROUND(AVG(avg_protein), 0), 0),
        ''carbs'', COALESCE(ROUND(AVG(avg_carbs), 0), 0),
        ''fat'', COALESCE(ROUND(AVG(avg_fat), 0), 0),
        ''weeks_count'', COUNT(*)
      )
      FROM weekly_analytics_cache
      ' || CASE WHEN p_days_back IS NOT NULL THEN ' WHERE week_start >= DATE_TRUNC(''week'', CURRENT_DATE - INTERVAL ''' || (p_days_back - 1) || ' days'')' ELSE '' END || '
    ),

    ''monthly_averages'', (
      SELECT jsonb_build_object(
        ''calories'', COALESCE(ROUND(AVG(avg_calories), 0), 0),
        ''protein'', COALESCE(ROUND(AVG(avg_protein), 0), 0),
        ''carbs'', COALESCE(ROUND(AVG(avg_carbs), 0), 0),
        ''fat'', COALESCE(ROUND(AVG(avg_fat), 0), 0),
        ''months_count'', COUNT(*)
      )
      FROM monthly_analytics_cache
      ' || CASE WHEN p_days_back IS NOT NULL THEN ' WHERE month_start >= DATE_TRUNC(''month'', CURRENT_DATE - INTERVAL ''' || (p_days_back - 1) || ' days'')' ELSE '' END || '
    ),

    ''calorie_extremes'', (
      SELECT jsonb_build_object(
        ''highest'', (
          SELECT jsonb_build_object(
            ''date'', date,
            ''calories'', ROUND(calories, 0)
          )
          FROM daily_analytics_cache
          ' || date_filter_condition || '
          ORDER BY calories DESC
          LIMIT 1
        ),
        ''lowest'', (
          SELECT jsonb_build_object(
            ''date'', date,
            ''calories'', ROUND(calories, 0)
          )
          FROM daily_analytics_cache
          ' || date_filter_condition || '
          ORDER BY calories ASC
          LIMIT 1
        )
      )
    ),

    ''summary'', (
      SELECT jsonb_build_object(
        ''total_meals'', (
          SELECT COALESCE(SUM(meals_count), 0)
          FROM daily_analytics_cache
          ' || date_filter_condition || '
        ),
        ''days_with_data'', (
          SELECT COUNT(*)
          FROM daily_analytics_cache
          ' || date_filter_condition || '
        )
      )
    )
  )'
  INTO result;

  RETURN result;
END;
$$;

-- Update analytics cache trigger to aggregate by date (all users combined)
-- This replaces per-user-per-date caching with system-wide-per-date caching
CREATE OR REPLACE FUNCTION update_analytics_cache()
RETURNS TRIGGER AS $$
DECLARE
  affected_date DATE;
  affected_week DATE;
  affected_month DATE;
BEGIN
  -- Determine which date was affected
  IF TG_OP = 'DELETE' THEN
    affected_date := OLD.eaten_on;
  ELSE
    affected_date := NEW.eaten_on;
  END IF;

  -- Calculate week start (Monday) and month start
  affected_week := DATE_TRUNC('week', affected_date)::DATE;
  affected_month := DATE_TRUNC('month', affected_date)::DATE;

  -- 1. Update DAILY cache for the affected date (aggregate ALL users for this date)
  -- Use NULL user_id for system-wide aggregation
  INSERT INTO daily_analytics_cache (user_id, date, calories, protein, carbs, fat, meals_count)
  SELECT
    NULL, -- NULL user_id represents "all users" aggregate
    affected_date,
    COALESCE(SUM((macros->>'calories')::numeric), 0),
    COALESCE(SUM((macros->>'protein')::numeric), 0),
    COALESCE(SUM((macros->>'carbs')::numeric), 0),
    COALESCE(SUM((macros->>'fat')::numeric), 0),
    COUNT(*)
  FROM meal_logs
  WHERE eaten_on = affected_date
  ON CONFLICT (user_id, date) DO UPDATE SET
    calories = EXCLUDED.calories,
    protein = EXCLUDED.protein,
    carbs = EXCLUDED.carbs,
    fat = EXCLUDED.fat,
    meals_count = EXCLUDED.meals_count,
    updated_at = NOW();

  -- If no meals left for this date, remove the daily cache entry
  IF NOT EXISTS (SELECT 1 FROM meal_logs WHERE eaten_on = affected_date) THEN
    DELETE FROM daily_analytics_cache WHERE user_id IS NULL AND date = affected_date;
  END IF;

  -- 2. Update WEEKLY cache for the affected week (aggregate ALL data for this week)
  INSERT INTO weekly_analytics_cache (user_id, week_start, avg_calories, avg_protein, avg_carbs, avg_fat, days_with_data)
  SELECT
    NULL,
    affected_week,
    COALESCE(AVG(calories), 0),
    COALESCE(AVG(protein), 0),
    COALESCE(AVG(carbs), 0),
    COALESCE(AVG(fat), 0),
    COUNT(*)
  FROM daily_analytics_cache
  WHERE user_id IS NULL
    AND date >= affected_week
    AND date < affected_week + INTERVAL '7 days'
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    avg_calories = EXCLUDED.avg_calories,
    avg_protein = EXCLUDED.avg_protein,
    avg_carbs = EXCLUDED.avg_carbs,
    avg_fat = EXCLUDED.avg_fat,
    days_with_data = EXCLUDED.days_with_data,
    updated_at = NOW();

  -- Remove weekly cache if no daily data exists for this week
  IF NOT EXISTS (
    SELECT 1 FROM daily_analytics_cache
    WHERE user_id IS NULL
      AND date >= affected_week
      AND date < affected_week + INTERVAL '7 days'
  ) THEN
    DELETE FROM weekly_analytics_cache WHERE user_id IS NULL AND week_start = affected_week;
  END IF;

  -- 3. Update MONTHLY cache for the affected month (aggregate ALL data for this month)
  INSERT INTO monthly_analytics_cache (user_id, month_start, avg_calories, avg_protein, avg_carbs, avg_fat, days_with_data)
  SELECT
    NULL,
    affected_month,
    COALESCE(AVG(calories), 0),
    COALESCE(AVG(protein), 0),
    COALESCE(AVG(carbs), 0),
    COALESCE(AVG(fat), 0),
    COUNT(*)
  FROM daily_analytics_cache
  WHERE user_id IS NULL
    AND date >= affected_month
    AND date < affected_month + INTERVAL '1 month'
  ON CONFLICT (user_id, month_start) DO UPDATE SET
    avg_calories = EXCLUDED.avg_calories,
    avg_protein = EXCLUDED.avg_protein,
    avg_carbs = EXCLUDED.avg_carbs,
    avg_fat = EXCLUDED.avg_fat,
    days_with_data = EXCLUDED.days_with_data,
    updated_at = NOW();

  -- Remove monthly cache if no daily data exists for this month
  IF NOT EXISTS (
    SELECT 1 FROM daily_analytics_cache
    WHERE user_id IS NULL
      AND date >= affected_month
      AND date < affected_month + INTERVAL '1 month'
  ) THEN
    DELETE FROM monthly_analytics_cache WHERE user_id IS NULL AND month_start = affected_month;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Bulk insert functions (bulk_insert_items, bulk_insert_recipes, bulk_insert_meal_logs)
-- already use COALESCE((record->>'user_id')::UUID, auth.uid()) which will:
-- - Use provided user_id if present in the data
-- - Fall back to auth.uid() for authenticated users
-- - Work with Service Role key (bypasses auth entirely)
-- No changes needed for bulk insert functions.

-- Note: The trigger is already attached to meal_logs table from previous migration
-- No need to recreate the trigger, only the function was updated


-- ============================================================================
-- PART 4: Backfill Analytics Cache with System-Wide Data
-- ============================================================================

-- Clear existing per-user analytics cache entries
TRUNCATE TABLE daily_analytics_cache CASCADE;
TRUNCATE TABLE weekly_analytics_cache CASCADE;
TRUNCATE TABLE monthly_analytics_cache CASCADE;

-- Backfill daily analytics cache (aggregate all users per date)
INSERT INTO daily_analytics_cache (user_id, date, calories, protein, carbs, fat, meals_count, updated_at)
SELECT
  NULL, -- NULL user_id represents "all users" aggregate
  eaten_on AS date,
  COALESCE(SUM((macros->>'calories')::numeric), 0) AS calories,
  COALESCE(SUM((macros->>'protein')::numeric), 0) AS protein,
  COALESCE(SUM((macros->>'carbs')::numeric), 0) AS carbs,
  COALESCE(SUM((macros->>'fat')::numeric), 0) AS fat,
  COUNT(*) AS meals_count,
  NOW() AS updated_at
FROM meal_logs
WHERE eaten_on IS NOT NULL
GROUP BY eaten_on
ORDER BY eaten_on;

-- Backfill weekly analytics cache (aggregate from daily cache)
INSERT INTO weekly_analytics_cache (user_id, week_start, avg_calories, avg_protein, avg_carbs, avg_fat, days_with_data, updated_at)
SELECT
  NULL,
  DATE_TRUNC('week', date)::DATE AS week_start,
  COALESCE(AVG(calories), 0) AS avg_calories,
  COALESCE(AVG(protein), 0) AS avg_protein,
  COALESCE(AVG(carbs), 0) AS avg_carbs,
  COALESCE(AVG(fat), 0) AS avg_fat,
  COUNT(*) AS days_with_data,
  NOW() AS updated_at
FROM daily_analytics_cache
WHERE user_id IS NULL
GROUP BY DATE_TRUNC('week', date)::DATE
ORDER BY week_start;

-- Backfill monthly analytics cache (aggregate from daily cache)
INSERT INTO monthly_analytics_cache (user_id, month_start, avg_calories, avg_protein, avg_carbs, avg_fat, days_with_data, updated_at)
SELECT
  NULL,
  DATE_TRUNC('month', date)::DATE AS month_start,
  COALESCE(AVG(calories), 0) AS avg_calories,
  COALESCE(AVG(protein), 0) AS avg_protein,
  COALESCE(AVG(carbs), 0) AS avg_carbs,
  COALESCE(AVG(fat), 0) AS avg_fat,
  COUNT(*) AS days_with_data,
  NOW() AS updated_at
FROM daily_analytics_cache
WHERE user_id IS NULL
GROUP BY DATE_TRUNC('month', date)::DATE
ORDER BY month_start;

-- Log results
DO $$
BEGIN
  RAISE NOTICE 'Backfilled % daily analytics entries', (SELECT COUNT(*) FROM daily_analytics_cache);
  RAISE NOTICE 'Backfilled % weekly analytics entries', (SELECT COUNT(*) FROM weekly_analytics_cache);
  RAISE NOTICE 'Backfilled % monthly analytics entries', (SELECT COUNT(*) FROM monthly_analytics_cache);
END$$;
