-- Two changes so ownership/delegation can target anyone in the system,
-- while which reminders you can act on at all stays visibility-scoped:
--
-- 1. owners is now a full directory — visible to any authenticated user,
--    not just owners you have a visibility grant onto. You need to be able
--    to see someone exists to hand a task to them.
-- 2. reminders UPDATE keeps USING owner_is_visible(owner_id) (you can only
--    act on reminders you can currently see) but the WITH CHECK no longer
--    re-validates visibility of the *new* owner_id/assignee_id — so you can
--    reassign to anyone, not just owners you personally have access to.
--    Same relaxation on INSERT's WITH CHECK for consistency.

drop policy "Owners can view visible owners" on owners;

create policy "Authenticated users can view the owners directory"
  on owners for select
  using (auth.uid() is not null);

drop policy "Owners can insert reminders they can see" on reminders;
create policy "Owners can insert reminders"
  on reminders for insert
  with check (true);

drop policy "Owners can update visible reminders" on reminders;
create policy "Owners can update visible reminders"
  on reminders for update
  using (owner_is_visible(owner_id))
  with check (true);
