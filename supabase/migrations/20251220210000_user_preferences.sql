-- User preferences for Smart Auto context and pinned contexts
-- Supports the Perplexity-style landing experience

create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_company_id uuid references companies(id) on delete set null,
  last_department_ids uuid[] default '{}',
  last_role_ids uuid[] default '{}',
  last_project_id uuid references projects(id) on delete set null,
  last_playbook_ids uuid[] default '{}',
  pinned_contexts jsonb default '[]'::jsonb,
  -- Pinned contexts format: [{ "name": "Marketing CMO", "company_id": uuid, "department_ids": [], "role_ids": [] }]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table user_preferences enable row level security;

-- Users can only read/write their own preferences
create policy "Users can view own preferences"
  on user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own preferences"
  on user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on user_preferences for update
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_user_preferences_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_preferences_updated_at
  before update on user_preferences
  for each row
  execute function update_user_preferences_updated_at();

-- Index for faster lookups
create index if not exists idx_user_preferences_user_id on user_preferences(user_id);

comment on table user_preferences is 'Stores user context preferences for Smart Auto feature';
comment on column user_preferences.pinned_contexts is 'User-pinned context combinations for quick access';