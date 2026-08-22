-- Projects: a simple per-user grouping for reminders, independent of the
-- owners/visibility model (like locations/rooms, tied directly to
-- auth.uid()). A reminder belongs to at most one project; projects have a
-- manually-orderable priority (lower = higher priority, shown first).

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) > 0),
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create index projects_owner_id_idx on projects (owner_id);
create index projects_priority_idx on projects (priority);

alter table projects enable row level security;

create policy "Users can view their own projects"
  on projects for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own projects"
  on projects for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own projects"
  on projects for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete their own projects"
  on projects for delete
  using (auth.uid() = owner_id);

create trigger projects_set_updated_at
  before update on projects
  for each row
  execute function set_updated_at();

-- New projects append to the end of priority order by default.
create function next_project_priority()
returns integer
language sql
stable
as $$
  select coalesce(max(priority), -1) + 1 from projects where owner_id = auth.uid();
$$;

alter table projects alter column priority set default next_project_priority();

alter table reminders
  add column project_id uuid references projects (id) on delete set null;

create index reminders_project_id_idx on reminders (project_id);
