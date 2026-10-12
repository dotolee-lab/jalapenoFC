-- 노쇼·지각 기록 + 일정(스케줄)
-- Supabase > SQL Editor 새 탭에 붙여넣고 Run 하세요. (다시 실행해도 괜찮아요)

-- 1) 경기일별 지각·노쇼 명단
alter table public.match_days add column if not exists lates   bigint[] not null default '{}';
alter table public.match_days add column if not exists noshows bigint[] not null default '{}';

-- 2) 일정 (경기 / 회비 / 기타, 매주·매월 반복 가능)
create table if not exists public.events (
  id bigint generated always as identity primary key,
  event_date date not null,
  event_time text check (event_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  kind   text not null default '기타' check (kind in ('경기','회비','기타')),
  title  text not null check (char_length(title) between 1 and 60),
  place  text check (char_length(place) <= 60),
  repeat text not null default 'none' check (repeat in ('none','weekly','monthly')),
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;

-- 일정은 누구나 볼 수 있고, 추가·삭제는 관리자(로그인)만
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'events' and policyname = 'events_read_all') then
    create policy "events_read_all" on public.events for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'events' and policyname = 'events_admin_write') then
    create policy "events_admin_write" on public.events for all to authenticated using (true) with check (true);
  end if;
end $$;
