-- Rooms nest under a location (e.g. Home -> Living Room, Basement).
-- RLS-scoped to auth.uid(), same as locations and reminders.

create table rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  location_id uuid not null references locations (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_location_id_idx on rooms (location_id);

alter table rooms enable row level security;

create policy "Users can view their own rooms"
  on rooms for select
  using (auth.uid() = user_id);

create policy "Users can insert their own rooms"
  on rooms for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own rooms"
  on rooms for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own rooms"
  on rooms for delete
  using (auth.uid() = user_id);

create trigger rooms_set_updated_at
  before update on rooms
  for each row
  execute function set_updated_at();

alter table reminders
  add column room_id uuid references rooms (id) on delete set null;

create index reminders_room_id_idx on reminders (room_id);
