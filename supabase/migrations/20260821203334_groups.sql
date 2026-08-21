-- Groups of family_members, so a reminder can be delegated to a group
-- ("Kids") instead of just one person. RLS-scoped to owner_id, same
-- pattern as everything else.

create table groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

alter table groups enable row level security;

create policy "Users can view their own groups"
  on groups for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own groups"
  on groups for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own groups"
  on groups for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete their own groups"
  on groups for delete
  using (auth.uid() = owner_id);

create trigger groups_set_updated_at
  before update on groups
  for each row
  execute function set_updated_at();

create table group_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  group_id uuid not null references groups (id) on delete cascade,
  family_member_id uuid not null references family_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, family_member_id)
);

create index group_members_group_id_idx on group_members (group_id);
create index group_members_family_member_id_idx on group_members (family_member_id);

alter table group_members enable row level security;

create policy "Users can view their own group members"
  on group_members for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own group members"
  on group_members for insert
  with check (auth.uid() = owner_id);

create policy "Users can delete their own group members"
  on group_members for delete
  using (auth.uid() = owner_id);

-- A reminder can be delegated to an individual OR a group, not both.
alter table reminders
  add column assignee_group_id uuid references groups (id) on delete set null;

create index reminders_assignee_group_id_idx on reminders (assignee_group_id);

alter table reminders
  add constraint reminders_assignee_single_target
  check (assignee_id is null or assignee_group_id is null);

-- Seed: All (everyone), Parents (Matt, Erika), Kids (Zachary, Xander).
with owner as (
  select id as owner_id from auth.users where email = 'mhanna@gmail.com'
),
new_groups as (
  insert into groups (owner_id, name)
  select owner_id, group_name
  from owner
  cross join unnest(array['All', 'Parents', 'Kids']) as group_name
  returning id, owner_id, name
)
insert into group_members (owner_id, group_id, family_member_id)
select ng.owner_id, ng.id, fm.id
from new_groups ng
join family_members fm on fm.owner_id = ng.owner_id
where
  ng.name = 'All'
  or (ng.name = 'Parents' and fm.name in ('Matt', 'Erika'))
  or (ng.name = 'Kids' and fm.name in ('Zachary', 'Xander'));
