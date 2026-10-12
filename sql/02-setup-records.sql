-- 개인 기록(출석·승무패·골·어시스트·MVP)용 표 만들기
-- Supabase > SQL Editor 새 탭에 붙여넣고 Run 하세요. (한 번만 실행)

-- 1) 경기일
create table if not exists public.match_days (
  id bigint generated always as identity primary key,
  played_on date not null unique,
  created_at timestamptz not null default now()
);

-- 2) 경기 결과 (그날 A팀 vs B팀 2:1 같은 한 경기씩)
create table if not exists public.match_games (
  id bigint generated always as identity primary key,
  day_id bigint not null references public.match_days(id) on delete cascade,
  home text not null check (home in ('A','B','C')),
  away text not null check (away in ('A','B','C')),
  home_score int not null default 0 check (home_score >= 0),
  away_score int not null default 0 check (away_score >= 0),
  created_at timestamptz not null default now()
);

-- 3) 경기일별 선수 기록 (출석·소속 팀·골·어시스트·MVP)
create table if not exists public.player_stats (
  day_id bigint not null references public.match_days(id) on delete cascade,
  player_id bigint not null references public.players(id) on delete cascade,
  team text check (team in ('A','B','C')),
  goals int not null default 0 check (goals >= 0),
  assists int not null default 0 check (assists >= 0),
  mvp boolean not null default false,
  primary key (day_id, player_id)
);

alter table public.match_days   enable row level security;
alter table public.match_games  enable row level security;
alter table public.player_stats enable row level security;

-- 기록은 누구나 볼 수 있고, 입력·수정은 관리자(로그인)만
create policy "days_read_all"     on public.match_days   for select to anon, authenticated using (true);
create policy "days_admin_write"  on public.match_days   for all to authenticated using (true) with check (true);
create policy "games_read_all"    on public.match_games  for select to anon, authenticated using (true);
create policy "games_admin_write" on public.match_games  for all to authenticated using (true) with check (true);
create policy "stats_read_all"    on public.player_stats for select to anon, authenticated using (true);
create policy "stats_admin_write" on public.player_stats for all to authenticated using (true) with check (true);
