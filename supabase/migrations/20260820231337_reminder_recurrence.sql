-- Recurrence for reminders. A recurring reminder never permanently completes:
-- completing/skipping it just advances due_at to the next occurrence.
--
-- recurrence_weekday is only meaningful when recurrence_freq = 'weekly'. When set,
-- it pins the reminder to that weekday (0 = Sunday .. 6 = Saturday) so the next
-- occurrence self-corrects to it even if due_at has drifted from a snooze. When
-- null, weekly recurrence just rolls forward 7 days from the current due_at.

alter table reminders
  add column recurrence_freq text check (recurrence_freq in ('daily', 'weekly', 'monthly')),
  add column recurrence_weekday smallint check (recurrence_weekday between 0 and 6);

alter table reminders
  add constraint reminders_recurrence_weekday_requires_weekly
  check (recurrence_weekday is null or recurrence_freq = 'weekly');
