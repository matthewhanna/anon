-- The previous migration revoked EXECUTE from PUBLIC, but anon still had
-- it — this project's default privileges grant EXECUTE on new
-- public-schema functions to anon independently of PUBLIC. Revoke that
-- explicitly too, so only authenticated can call these.
revoke execute on function reassign_reminder_owner(uuid, uuid) from anon;
revoke execute on function reassign_reminder_assignee(uuid, uuid) from anon;
