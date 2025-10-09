-- Migration: Remove OAuth codes table (reverting to different auth approach)

-- Drop the table and all associated policies
DROP TABLE IF EXISTS public.oauth_codes CASCADE;
