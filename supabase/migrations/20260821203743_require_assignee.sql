-- Every reminder must be assigned to someone or some group — no unassigned
-- state. Combined with the existing "one or the other, not both" constraint,
-- this makes assignee_id/assignee_group_id exactly one non-null.
alter table reminders
  add constraint reminders_assignee_required
  check (assignee_id is not null or assignee_group_id is not null);
