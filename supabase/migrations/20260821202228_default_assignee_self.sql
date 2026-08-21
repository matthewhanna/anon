-- Add Matt as a family member too — unlike the placeholders, his auth_user_id
-- is already set since he has a real account.
insert into family_members (owner_id, auth_user_id, name)
select u.id, u.id, 'Matt'
from auth.users u
where u.email = 'mhanna@gmail.com';

-- New reminders default to the creator's own family_members row, so tasks
-- you create default to you without the app having to know your id. An
-- explicit assignment (at insert or later) always overrides this.
-- (Postgres doesn't allow a bare subquery in DEFAULT, so this needs a function.)
create function default_assignee()
returns uuid
language sql
stable
as $$
  select id from family_members where auth_user_id = auth.uid() limit 1;
$$;

alter table reminders
  alter column assigned_to_id set default default_assignee();
