-- Migration: add helper table to store short-lived OAuth codes for GPT flow
create table if not exists public.oauth_codes (
  code text primary key,
  user_id uuid not null,
  access_token text not null,
  refresh_token text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Add indexes for performance
create index if not exists oauth_codes_user_id_idx on public.oauth_codes (user_id);
create index if not exists oauth_codes_expires_at_idx on public.oauth_codes (expires_at);

alter table public.oauth_codes enable row level security;

-- Deny all direct access - this table should only be accessed via service role
create policy "deny all on oauth_codes"
on public.oauth_codes
for all
using (false)
with check (false);
