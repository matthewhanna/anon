-- The reassignment RPCs' internal owner_is_visible() check already makes
-- calling them as an unauthenticated (anon) user a no-op — auth.uid() is
-- null, so visibility never passes. But they were never explicitly
-- revoked from PUBLIC, so anon had EXECUTE granted anyway (Postgres's
-- default on CREATE FUNCTION). Tighten to defense-in-depth: only
-- authenticated can even attempt the call.
revoke execute on function reassign_reminder_owner(uuid, uuid) from public;
revoke execute on function reassign_reminder_assignee(uuid, uuid) from public;
