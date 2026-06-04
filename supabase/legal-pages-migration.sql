-- Phase 6: legal pages and owner terms acceptance.
-- Run this in the Supabase SQL Editor for existing environments.

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

create index if not exists profiles_terms_accepted_at_idx
  on public.profiles(terms_accepted_at);
