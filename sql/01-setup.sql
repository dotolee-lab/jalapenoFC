-- 풋살 팀 밸런서 DB 설정
-- Supabase > SQL Editor 에 전체를 붙여넣고 Run 하세요. (한 번만 실행)

-- 1) 선수 기본 정보: 누구나 볼 수 있음
create table if not exists public.players (
  id bigint generated always as identity primary key,
  name text not null unique,
  pos text[] not null default '{미드}',
  gk boolean not null default false,
  attending boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) 등급·활동량: 관리자만 볼 수 있음
create table if not exists public.player_ratings (
  player_id bigint primary key references public.players(id) on delete cascade,
  grade int not null default 3 check (grade between 1 and 5),
  act text not null default '보통' check (act in ('좋음','보통','나쁨'))
);

-- 3) 공개된 최근 팀 구성 (이름·포지션·키퍼만 저장)
create table if not exists public.team_results (
  id int primary key default 1 check (id = 1),
  teams jsonb not null,
  created_at timestamptz not null default now()
);

-- 보안 규칙(RLS) 켜기
alter table public.players        enable row level security;
alter table public.player_ratings enable row level security;
alter table public.team_results   enable row level security;

-- 선수 명단: 누구나 조회, 관리자(로그인)만 추가·수정·삭제
create policy "players_read_all"   on public.players for select to anon, authenticated using (true);
create policy "players_admin_write" on public.players for all to authenticated using (true) with check (true);

-- 등급·활동량: 관리자(로그인)만 조회·수정 → 일반 사용자는 데이터 자체를 받을 수 없음
create policy "ratings_admin_only" on public.player_ratings for all to authenticated using (true) with check (true);

-- 팀 결과: 누구나 조회, 관리자만 저장
create policy "results_read_all"    on public.team_results for select to anon, authenticated using (true);
create policy "results_admin_write" on public.team_results for all to authenticated using (true) with check (true);

-- 참석 체크: 로그인 안 한 사람도 '참석 여부'만 바꿀 수 있는 전용 함수
create or replace function public.set_attendance(p_id bigint, p_on boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.players set attending = p_on where id = p_id;
$$;
revoke all on function public.set_attendance(bigint, boolean) from public;
grant execute on function public.set_attendance(bigint, boolean) to anon, authenticated;
