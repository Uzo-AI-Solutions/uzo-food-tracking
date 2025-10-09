-- Disable RLS on all tables for public access
-- This allows anon key to read/write without authentication
-- NOTE: This is for personal/prototype use only - removes all data isolation

-- Disable RLS on main tables
ALTER TABLE items DISABLE ROW LEVEL SECURITY;
ALTER TABLE recipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE meal_logs DISABLE ROW LEVEL SECURITY;

-- Disable RLS on analytics cache tables
ALTER TABLE daily_analytics_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_analytics_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_analytics_cache DISABLE ROW LEVEL SECURITY;


-- Drop all existing RLS policies (cleanup)
-- Main tables
DROP POLICY IF EXISTS "User can access own items" ON items;
DROP POLICY IF EXISTS "User can insert own items" ON items;
DROP POLICY IF EXISTS "User can access own recipes" ON recipes;
DROP POLICY IF EXISTS "User can insert own recipes" ON recipes;
DROP POLICY IF EXISTS "User can access own meal_logs" ON meal_logs;
DROP POLICY IF EXISTS "User can insert own meal_logs" ON meal_logs;

-- Analytics cache tables
DROP POLICY IF EXISTS "User can access own daily_analytics_cache" ON daily_analytics_cache;
DROP POLICY IF EXISTS "User can access own weekly_analytics_cache" ON weekly_analytics_cache;
DROP POLICY IF EXISTS "User can access own monthly_analytics_cache" ON monthly_analytics_cache;

-- Drop any other possible policy names from previous migrations
DROP POLICY IF EXISTS "Users can view their own weekly analytics" ON weekly_analytics_cache;
DROP POLICY IF EXISTS "Allow anon and owner access to items" ON items;
DROP POLICY IF EXISTS "Allow anon and owner access to recipes" ON recipes;
DROP POLICY IF EXISTS "Allow anon and owner access to meal_logs" ON meal_logs;
DROP POLICY IF EXISTS "Allow anon and owner access to daily_analytics_cache" ON daily_analytics_cache;
DROP POLICY IF EXISTS "Allow anon and owner access to weekly_analytics_cache" ON weekly_analytics_cache;
DROP POLICY IF EXISTS "Allow anon and owner access to monthly_analytics_cache" ON monthly_analytics_cache;

-- Note: With RLS disabled, anyone with the anon key can access all data
-- This is acceptable for:
-- - Personal single-user applications
-- - Prototype/development phases
-- - Applications where all data is effectively public
--
-- Security is now "security through obscurity" - the anon key is the only barrier
