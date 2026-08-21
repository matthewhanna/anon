-- Backfill: reminders created before contexts existed have no context_id.
-- Give each affected user a "Home" context and assign their orphaned reminders to it,
-- so nothing disappears once the app starts filtering by context.

insert into contexts (user_id, name)
select distinct r.user_id, 'Home'
from reminders r
where r.context_id is null
  and not exists (
    select 1 from contexts c where c.user_id = r.user_id and c.name = 'Home'
  );

update reminders r
set context_id = c.id
from contexts c
where c.user_id = r.user_id
  and c.name = 'Home'
  and r.context_id is null;
