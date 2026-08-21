-- Contexts (Home, Work, ...): user-defined, RLS-scoped to auth.uid().
-- lat/lng/radius are nullable for now, populated once GPS-based auto-switching lands.

create table contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) > 0),
  latitude double precision,
  longitude double precision,
  radius_m integer check (radius_m > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contexts_user_id_idx on contexts (user_id);

alter table contexts enable row level security;

create policy "Users can view their own contexts"
  on contexts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own contexts"
  on contexts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own contexts"
  on contexts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own contexts"
  on contexts for delete
  using (auth.uid() = user_id);

create trigger contexts_set_updated_at
  before update on contexts
  for each row
  execute function set_updated_at();

alter table reminders
  add column context_id uuid references contexts (id) on delete set null;

create index reminders_context_id_idx on reminders (context_id);
