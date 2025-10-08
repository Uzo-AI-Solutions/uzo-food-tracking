-- Remove anonymous access from all RLS policies
-- Only authenticated users can access their own data

-- Drop all existing policies (including public/anon access policies)
-- Main tables - items
DROP POLICY IF EXISTS "Allow anon and owner access to items" ON items;
DROP POLICY IF EXISTS "Allow anon and owner insert to items" ON items;
DROP POLICY IF EXISTS "User can access own items" ON items;
DROP POLICY IF EXISTS "User can insert own items" ON items;
DROP POLICY IF EXISTS "auth_all_items" ON items;

-- Main tables - recipes
DROP POLICY IF EXISTS "Allow anon and owner access to recipes" ON recipes;
DROP POLICY IF EXISTS "Allow anon and owner insert to recipes" ON recipes;
DROP POLICY IF EXISTS "User can access own recipes" ON recipes;
DROP POLICY IF EXISTS "User can insert own recipes" ON recipes;
DROP POLICY IF EXISTS "auth_all_recipes" ON recipes;

-- Main tables - meal_logs
DROP POLICY IF EXISTS "Allow anon and owner access to meal_logs" ON meal_logs;
DROP POLICY IF EXISTS "Allow anon and owner insert to meal_logs" ON meal_logs;
DROP POLICY IF EXISTS "User can access own meal_logs" ON meal_logs;
DROP POLICY IF EXISTS "User can insert own meal_logs" ON meal_logs;
DROP POLICY IF EXISTS "auth_all_meal_logs" ON meal_logs;

-- Analytics cache tables - daily
DROP POLICY IF EXISTS "Allow anon and owner access to daily_analytics_cache" ON daily_analytics_cache;
DROP POLICY IF EXISTS "User can access own daily_analytics_cache" ON daily_analytics_cache;
DROP POLICY IF EXISTS "auth_all_daily_analytics_cache" ON daily_analytics_cache;

-- Analytics cache tables - weekly
DROP POLICY IF EXISTS "Allow anon and owner access to weekly_analytics_cache" ON weekly_analytics_cache;
DROP POLICY IF EXISTS "User can access own weekly_analytics_cache" ON weekly_analytics_cache;
DROP POLICY IF EXISTS "auth_all_weekly_analytics_cache" ON weekly_analytics_cache;

-- Analytics cache tables - monthly
DROP POLICY IF EXISTS "Allow anon and owner access to monthly_analytics_cache" ON monthly_analytics_cache;
DROP POLICY IF EXISTS "User can access own monthly_analytics_cache" ON monthly_analytics_cache;
DROP POLICY IF EXISTS "auth_all_monthly_analytics_cache" ON monthly_analytics_cache;

-- Create user-only RLS policies for main tables
-- Using (SELECT auth.uid()) for performance optimization (caching per statement)
-- TO authenticated ensures policies only evaluate for authenticated users
CREATE POLICY "User can access own items" ON items
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "User can insert own items" ON items
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "User can access own recipes" ON recipes
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "User can insert own recipes" ON recipes
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "User can access own meal_logs" ON meal_logs
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "User can insert own meal_logs" ON meal_logs
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Create user-only RLS policies for analytics cache tables
CREATE POLICY "User can access own daily_analytics_cache" ON daily_analytics_cache
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "User can access own weekly_analytics_cache" ON weekly_analytics_cache
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "User can access own monthly_analytics_cache" ON monthly_analytics_cache
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);
