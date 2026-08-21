-- Postgres requires the *new* row of an UPDATE to also pass the table's
-- SELECT policy, regardless of what WITH CHECK says — verified directly
-- against a throwaway table, independent of this schema. So a plain
-- UPDATE can never write owner_id/assignee_id to something outside the
-- caller's own visibility, since that would make the row invisible to
-- them immediately after. The only correct way around this is a
-- SECURITY DEFINER function, which bypasses RLS on its internal UPDATE
-- entirely — it re-checks visibility of the CURRENT reminder manually
-- (the "can I act on this at all" gate) but doesn't re-check the new
-- owner/assignee value.
--
-- Revert reminders' INSERT/UPDATE WITH CHECK back to owner_is_visible —
-- the "true" from the previous migration never actually worked as intended.

drop policy "Owners can insert reminders" on reminders;
create policy "Owners can insert reminders they can see"
  on reminders for insert
  with check (owner_is_visible(owner_id));

drop policy "Owners can update visible reminders" on reminders;
create policy "Owners can update visible reminders"
  on reminders for update
  using (owner_is_visible(owner_id))
  with check (owner_is_visible(owner_id));

create function reassign_reminder_owner(target_reminder_id uuid, new_owner_id uuid)
returns reminders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result reminders;
begin
  if not exists (
    select 1 from reminders r where r.id = target_reminder_id and owner_is_visible(r.owner_id)
  ) then
    raise exception 'reminder not found or not visible';
  end if;

  update reminders set owner_id = new_owner_id where id = target_reminder_id
  returning * into result;

  return result;
end;
$$;

create function reassign_reminder_assignee(target_reminder_id uuid, new_assignee_id uuid)
returns reminders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result reminders;
begin
  if not exists (
    select 1 from reminders r where r.id = target_reminder_id and owner_is_visible(r.owner_id)
  ) then
    raise exception 'reminder not found or not visible';
  end if;

  if not exists (select 1 from owners where id = new_assignee_id and is_individual) then
    raise exception 'assignee_id must reference an individual owner (is_individual = true)';
  end if;

  update reminders set assignee_id = new_assignee_id where id = target_reminder_id
  returning * into result;

  return result;
end;
$$;

grant execute on function reassign_reminder_owner(uuid, uuid) to authenticated;
grant execute on function reassign_reminder_assignee(uuid, uuid) to authenticated;
