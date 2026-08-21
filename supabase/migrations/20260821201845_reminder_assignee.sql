alter table reminders
  add column assigned_to_id uuid references family_members (id) on delete set null;

create index reminders_assigned_to_id_idx on reminders (assigned_to_id);
