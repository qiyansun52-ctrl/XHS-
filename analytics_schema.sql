-- 在 Supabase Dashboard → SQL Editor 里粘贴并执行

-- ── 自有账号历史快照 ─────────────────────────────────────────────
create table if not exists account_stats_history (
  id           uuid primary key default gen_random_uuid(),
  account_id   integer not null,
  date         date    not null default current_date,
  followers    integer default 0,
  likes        integer default 0,
  views        integer default 0,
  saves        integer default 0,
  created_at   timestamptz default now(),
  unique(account_id, date)
);

alter table account_stats_history enable row level security;
create policy "team_access" on account_stats_history for all using (true) with check (true);

-- ── 对标账号历史快照 ─────────────────────────────────────────────
create table if not exists benchmark_stats_history (
  id             uuid primary key default gen_random_uuid(),
  benchmark_id   uuid not null references benchmark_accounts(id) on delete cascade,
  date           date not null default current_date,
  followers      integer default 0,
  created_at     timestamptz default now(),
  unique(benchmark_id, date)
);

alter table benchmark_stats_history enable row level security;
create policy "team_access" on benchmark_stats_history for all using (true) with check (true);
