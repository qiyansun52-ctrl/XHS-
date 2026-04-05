-- 在 Supabase Dashboard → SQL Editor 里粘贴并执行这段 SQL

create table posts (
  id           uuid primary key default gen_random_uuid(),
  account_id   integer not null,
  title        text    not null,
  caption      text,
  scheduled_at text,
  status       text    default 'draft' check (status in ('draft', 'scheduled', 'published')),
  tags         text[],
  img_count    integer default 0,
  created_at   timestamp with time zone default now()
);

-- 允许所有人读写（内部工具，无需登录验证）
alter table posts enable row level security;
create policy "team_access" on posts for all using (true) with check (true);
