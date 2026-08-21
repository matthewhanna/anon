-- Placeholder family members: name-only, no login yet. auth_user_id is
-- reserved for later, when someone gets their own real account — at that
-- point this row just gets linked rather than anything that references it
-- (e.g. a future reminders.assigned_to_id) needing to change.

create table family_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  auth_user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create index family_members_owner_id_idx on family_members (owner_id);

alter table family_members enable row level security;

create policy "Users can view their own family members"
  on family_members for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own family members"
  on family_members for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own family members"
  on family_members for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete their own family members"
  on family_members for delete
  using (auth.uid() = owner_id);

create trigger family_members_set_updated_at
  before update on family_members
  for each row
  execute function set_updated_at();

insert into family_members (owner_id, name)
select u.id, member_name
from auth.users u
cross join unnest(array['Erika', 'Zachary', 'Xander']) as member_name
where u.email = 'mhanna@gmail.com';
