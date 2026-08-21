-- Collapses family_members + groups + group_members into one polymorphic
-- "owners" model: an owner is either an individual (is_individual = true,
-- may have a real auth_user_id) or a group (is_individual = false, never
-- logs in itself). owner_visibility replaces group_members: a general
-- "viewer can see visible_owner" mapping, not specifically "member of."
--
-- reminders.owner_id now points at owners (not auth.users directly) and can
-- be an individual OR a group. reminders.owner_group_id is gone — a group
-- is just an owner now, no separate column needed. Delegation (assignee_id)
-- stays individual-only, enforced by a trigger since Postgres CHECK
-- constraints can't do cross-table lookups.
--
-- Permissions are unified and simple: if you can see an owner (you are it,
-- or you have a visibility grant onto it), you have full SELECT/INSERT/
-- UPDATE/DELETE on anything owned by it. No separate "can view but not
-- delete" tier this time — that asymmetry was part of what made the
-- previous design confusing.

create table owners (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  auth_user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) > 0),
  is_individual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, name),
  check (auth_user_id is null or is_individual)
);

create trigger owners_set_updated_at
  before update on owners
  for each row
  execute function set_updated_at();

create table owner_visibility (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  viewer_id uuid not null references owners (id) on delete cascade,
  visible_owner_id uuid not null references owners (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (viewer_id, visible_owner_id)
);

-- Backfill: reuse the existing family_members/groups ids as the new owners
-- ids, so reminders.assignee_id (already pointing at family_members.id)
-- keeps working without needing a data rewrite.
insert into owners (id, creator_id, auth_user_id, name, is_individual, created_at, updated_at)
select id, owner_id, auth_user_id, name, true, created_at, updated_at
from family_members;

insert into owners (id, creator_id, name, is_individual, created_at, updated_at)
select id, owner_id, name, false, created_at, updated_at
from groups;

insert into owner_visibility (creator_id, viewer_id, visible_owner_id)
select gm.owner_id, gm.family_member_id, gm.group_id
from group_members gm;

drop policy "Users can view visible reminders" on reminders;
drop policy "Users can update visible reminders" on reminders;
drop policy "Users can insert their own reminders" on reminders;
drop policy "Users can delete their own reminders" on reminders;

drop function reminder_is_visible(uuid, uuid);

alter table reminders alter column assignee_id drop default;
drop function default_assignee();

alter table reminders drop constraint reminders_owner_id_fkey;
alter table reminders drop constraint reminders_assignee_id_fkey;
alter table reminders drop constraint reminders_owner_group_id_fkey;

alter table reminders drop column owner_group_id;

-- reminders.owner_id currently holds auth.users ids (it defaulted to
-- auth.uid() directly) — repoint each to the matching individual's new
-- owners.id.
update reminders
set owner_id = owners.id
from owners
where owners.auth_user_id = reminders.owner_id;

alter table reminders
  add constraint reminders_owner_id_fkey foreign key (owner_id) references owners (id),
  add constraint reminders_assignee_id_fkey foreign key (assignee_id) references owners (id);

-- SECURITY DEFINER: needs to resolve visibility/ownership regardless of who
-- manages the owners/owner_visibility rows involved, not just what the
-- caller's own RLS on those tables would show them directly.
create function is_own_owner(check_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from owners where id = check_owner_id and auth_user_id = auth.uid()
  );
$$;

create function owner_is_visible(target_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select is_own_owner(target_owner_id)
    or exists (
      select 1
      from owner_visibility ov
      where ov.visible_owner_id = target_owner_id
        and is_own_owner(ov.viewer_id)
    );
$$;

create function default_owner()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from owners where auth_user_id = auth.uid() limit 1;
$$;

alter table reminders alter column owner_id set default default_owner();
alter table reminders alter column assignee_id set default default_owner();

create policy "Owners can access visible reminders"
  on reminders for select
  using (owner_is_visible(owner_id));

create policy "Owners can insert reminders they can see"
  on reminders for insert
  with check (owner_is_visible(owner_id));

create policy "Owners can update visible reminders"
  on reminders for update
  using (owner_is_visible(owner_id))
  with check (owner_is_visible(owner_id));

create policy "Owners can delete visible reminders"
  on reminders for delete
  using (owner_is_visible(owner_id));

-- Delegation is individual-only; CHECK constraints can't do cross-table
-- lookups, so this needs a trigger.
create function check_assignee_is_individual()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from owners where id = new.assignee_id and is_individual) then
    raise exception 'assignee_id must reference an individual owner (is_individual = true)';
  end if;
  return new;
end;
$$;

create trigger reminders_check_assignee
  before insert or update of assignee_id on reminders
  for each row
  execute function check_assignee_is_individual();

alter table owners enable row level security;

create policy "Owners can view visible owners"
  on owners for select
  using (owner_is_visible(id));

create policy "Users can manage their own owner rows"
  on owners for insert
  with check (auth.uid() = creator_id);

create policy "Users can update their own owner rows"
  on owners for update
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

create policy "Users can delete their own owner rows"
  on owners for delete
  using (auth.uid() = creator_id);

alter table owner_visibility enable row level security;

create policy "Users can view relevant visibility grants"
  on owner_visibility for select
  using (auth.uid() = creator_id or is_own_owner(viewer_id));

create policy "Users can manage their own visibility grants"
  on owner_visibility for insert
  with check (auth.uid() = creator_id);

create policy "Users can update their own visibility grants"
  on owner_visibility for update
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

create policy "Users can delete their own visibility grants"
  on owner_visibility for delete
  using (auth.uid() = creator_id);

drop table group_members;
drop table groups;
drop table family_members;
