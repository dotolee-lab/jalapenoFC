-- 일정 반복에 '6개월마다' 추가
-- Supabase > SQL Editor 새 탭에 붙여넣고 Run 하세요. (다시 실행해도 괜찮아요)
-- 'drop constraint' 때문에 경고 창이 뜰 수 있는데, 반복 종류 검사 규칙만 바꾸는 거라 일정 데이터는 그대로예요.

alter table public.events drop constraint if exists events_repeat_check;
alter table public.events add constraint events_repeat_check
  check (repeat in ('none','weekly','monthly','halfyear'));
