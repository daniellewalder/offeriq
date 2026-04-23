create extension if not exists pgcrypto;

create table if not exists public.shared_portals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  deal_analysis_id uuid not null,
  token text not null unique,
  access_code_hash text not null,
  title text,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists shared_portals_token_idx on public.shared_portals(token);
create index if not exists shared_portals_user_idx on public.shared_portals(user_id);

alter table public.shared_portals enable row level security;

create policy "Owners view their portals"
  on public.shared_portals for select to authenticated
  using (user_id = auth.uid());

create policy "Owners insert their portals"
  on public.shared_portals for insert to authenticated
  with check (user_id = auth.uid());

create policy "Owners update their portals"
  on public.shared_portals for update to authenticated
  using (user_id = auth.uid());

create policy "Owners delete their portals"
  on public.shared_portals for delete to authenticated
  using (user_id = auth.uid());