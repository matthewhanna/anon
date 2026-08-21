-- Owner/assignee model, named explicitly: owner_id (who created/controls a
-- row, RLS-gated) vs assignee_id (who a reminder is delegated to). Matches
-- family_members, which already uses owner_id. Renaming preserves defaults,
-- RLS policies, and data — Postgres tracks these by column position, not name.

alter table reminders rename column user_id to owner_id;
alter table reminders rename constraint reminders_user_id_fkey to reminders_owner_id_fkey;
alter index reminders_user_id_idx rename to reminders_owner_id_idx;

alter table reminders rename column assigned_to_id to assignee_id;
alter table reminders rename constraint reminders_assigned_to_id_fkey to reminders_assignee_id_fkey;
alter index reminders_assigned_to_id_idx rename to reminders_assignee_id_idx;

alter table locations rename column user_id to owner_id;
alter table locations rename constraint locations_user_id_fkey to locations_owner_id_fkey;
alter index locations_user_id_idx rename to locations_owner_id_idx;

alter table rooms rename column user_id to owner_id;
alter table rooms rename constraint rooms_user_id_fkey to rooms_owner_id_fkey;
