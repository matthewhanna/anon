-- Delegation (assignee) is individual-only now — group delegation is gone.
alter table reminders drop constraint reminders_assignee_single_target;
alter table reminders drop constraint reminders_assignee_required;
alter table reminders drop column assignee_group_id;
alter table reminders alter column assignee_id set not null;

-- Group ownership, Unix-file-ish: owner_id is the individual creator (unchanged,
-- still the only thing INSERT/DELETE care about — a group can't authenticate,
-- so it can never be the strict RLS owner). owner_group_id is like a file's
-- group: optional, and extends visibility/editing to everyone in that group.
alter table reminders
  add column owner_group_id uuid references groups (id) on delete set null;

create index reminders_owner_group_id_idx on reminders (owner_group_id);

-- SECURITY DEFINER: this needs to read group_members/family_members regardless
-- of whose row it's checking against, not just the caller's own group_members
-- rows (which normal RLS on group_members would otherwise restrict to the
-- group's creator). Scoped tightly: no writes, and only ever resolves against
-- the caller's own auth.uid(), never an arbitrary one.
create function reminder_is_visible(check_owner_id uuid, check_owner_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() = check_owner_id
    or (
      check_owner_group_id is not null
      and exists (
        select 1
        from group_members gm
        join family_members fm on fm.id = gm.family_member_id
        where gm.group_id = check_owner_group_id
          and fm.auth_user_id = auth.uid()
      )
    );
$$;

drop policy "Users can view their own reminders" on reminders;
create policy "Users can view visible reminders"
  on reminders for select
  using (reminder_is_visible(owner_id, owner_group_id));

drop policy "Users can update their own reminders" on reminders;
create policy "Users can update visible reminders"
  on reminders for update
  using (reminder_is_visible(owner_id, owner_group_id))
  with check (reminder_is_visible(owner_id, owner_group_id));

-- INSERT and DELETE stay strictly owner_id = auth.uid() (unchanged) — creating
-- and deleting are the individual owner's alone, group membership doesn't grant them.
