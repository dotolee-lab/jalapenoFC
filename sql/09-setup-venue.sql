-- 경기일별 구장(장소)
-- Supabase > SQL Editor 새 탭에 붙여넣고 Run 하세요. (다시 실행해도 괜찮아요)

alter table public.match_days add column if not exists venue text check (char_length(venue) <= 60);
