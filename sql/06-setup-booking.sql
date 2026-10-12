-- 구장 예약자 기록 (경기일마다 예약한 선수들)
-- Supabase > SQL Editor 새 탭에 붙여넣고 Run 하세요. (다시 실행해도 괜찮아요)
-- 누구나 볼 수 있고, 입력은 관리자만 할 수 있어요 (기존 경기일 보안 규칙 그대로).

alter table public.match_days add column if not exists bookers bigint[] not null default '{}';
