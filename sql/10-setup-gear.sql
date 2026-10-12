-- 장비 보관 현황 (조끼 / 장비 / 예비 장비)
-- Supabase > SQL Editor 새 탭에 붙여넣고 Run 하세요. (다시 실행해도 괜찮아요)
-- 누구나 볼 수 있고, '누가 가지고 있는지'는 누구나 바꿀 수 있어요 (아래 전용 함수로만).

create table if not exists public.gear (
  id text primary key,
  label text not null,
  max_holders int not null default 1,
  holders bigint[] not null default '{}',
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

-- 기본 항목: 조끼 1명, 장비 최대 3명, 예비 장비 1명
insert into public.gear (id, label, max_holders, sort) values
  ('vest',  '조끼',      1, 1),
  ('gear',  '장비',      3, 2),
  ('spare', '예비 장비', 1, 3)
on conflict (id) do nothing;

alter table public.gear enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'gear' and policyname = 'gear_read_all') then
    create policy "gear_read_all" on public.gear for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'gear' and policyname = 'gear_admin_write') then
    create policy "gear_admin_write" on public.gear for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 보관자 바꾸기 (누구나 사용 가능, 보관자만 바뀜)
create or replace function public.set_gear(p_id text, p_holders bigint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mx int;
begin
  select max_holders into mx from public.gear where id = p_id;
  if mx is null then
    raise exception '없는 항목이에요';
  end if;
  p_holders := coalesce(p_holders, '{}');
  if cardinality(p_holders) > mx then
    raise exception '최대 %명까지 고를 수 있어요', mx;
  end if;
  if exists (select 1 from unnest(p_holders) h where h not in (select id from public.players)) then
    raise exception '선수를 찾을 수 없어요';
  end if;
  update public.gear
     set holders = (select coalesce(array_agg(distinct h), '{}') from unnest(p_holders) h),
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.set_gear(text, bigint[]) from public;
grant execute on function public.set_gear(text, bigint[]) to anon, authenticated;
