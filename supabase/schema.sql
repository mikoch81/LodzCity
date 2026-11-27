-- Fabrykant: schemat bazy dla gry online. Uruchom raz w Supabase: SQL Editor -> New query -> Run.

-- Pełny stan gry (z kartami wszystkich graczy i tokenami). Bez polityk RLS:
-- czyta i zapisuje tylko serwer gry kluczem service_role.
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lobby jsonb not null,
  state jsonb,
  version integer not null default 0
);
alter table public.games enable row level security;

-- Sam numer wersji gry, publiczny do odczytu. Przeglądarki nasłuchują jego zmian
-- (Realtime) i wtedy pobierają swój widok gry z serwera.
create table if not exists public.game_versions (
  game_id uuid primary key references public.games (id) on delete cascade,
  version integer not null
);
alter table public.game_versions enable row level security;
drop policy if exists "game versions are public" on public.game_versions;
create policy "game versions are public" on public.game_versions for select using (true);

alter publication supabase_realtime add table public.game_versions;
