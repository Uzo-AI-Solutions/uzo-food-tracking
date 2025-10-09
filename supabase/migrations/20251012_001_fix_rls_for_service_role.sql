-- Fix RLS policies to allow service role key access
-- Changes TO authenticated → TO public to enable service role bypass
-- Service role automatically bypasses RLS (PostgreSQL security model)
-- Authenticated users still only see their own data (auth.uid() = user_id check)

-- Drop existing policies with TO authenticated restriction
DROP POLICY IF EXISTS "User can access own items" ON items;
DROP POLICY IF EXISTS "User can insert own items" ON items;
DROP POLICY IF EXISTS "User can access own recipes" ON recipes;
DROP POLICY IF EXISTS "User can insert own recipes" ON recipes;
DROP POLICY IF EXISTS "User can access own meal_logs" ON meal_logs;
DROP POLICY IF EXISTS "User can insert own meal_logs" ON meal_logs;
DROP POLICY IF EXISTS "User can access own daily_analytics_cache" ON daily_analytics_cache;
DROP POLICY IF EXISTS "User can access own weekly_analytics_cache" ON weekly_analytics_cache;
DROP POLICY IF EXISTS "User can access own monthly_analytics_cache" ON monthly_analytics_cache;

-- Recreate policies with TO public (allows service role to bypass RLS)
-- Main tables - items
CREATE POLICY "User can access own items" ON items
    FOR ALL
    TO public  -- Changed from "authenticated" to allow service role bypass
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "User can insert own items" ON items
    FOR INSERT
    TO public  -- Changed from "authenticated" to allow service role bypass
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Main tables - recipes
CREATE POLICY "User can access own recipes" ON recipes
    FOR ALL
    TO public  -- Changed from "authenticated" to allow service role bypass
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "User can insert own recipes" ON recipes
    FOR INSERT
    TO public  -- Changed from "authenticated" to allow service role bypass
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Main tables - meal_logs
CREATE POLICY "User can access own meal_logs" ON meal_logs
    FOR ALL
    TO public  -- Changed from "authenticated" to allow service role bypass
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "User can insert own meal_logs" ON meal_logs
    FOR INSERT
    TO public  -- Changed from "authenticated" to allow service role bypass
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Analytics cache tables - daily
CREATE POLICY "User can access own daily_analytics_cache" ON daily_analytics_cache
    FOR ALL
    TO public  -- Changed from "authenticated" to allow service role bypass
    USING ((SELECT auth.uid()) = user_id);

-- Analytics cache tables - weekly
CREATE POLICY "User can access own weekly_analytics_cache" ON weekly_analytics_cache
    FOR ALL
    TO public  -- Changed from "authenticated" to allow service role bypass
    USING ((SELECT auth.uid()) = user_id);

-- Analytics cache tables - monthly
CREATE POLICY "User can access own monthly_analytics_cache" ON monthly_analytics_cache
    FOR ALL
    TO public  -- Changed from "authenticated" to allow service role bypass
    USING ((SELECT auth.uid()) = user_id);
