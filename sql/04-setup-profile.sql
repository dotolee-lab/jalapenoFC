-- 개인 프로필용 칸 추가 (등번호·주발 점수·한마디·생년월일)
-- 이미 실행했어도 전체를 다시 실행해도 괜찮아요 (있는 칸은 건너뜀)
-- Supabase > SQL Editor 새 탭에 붙여넣고 Run 하세요. (한 번만 실행)
-- 누구나 볼 수 있는 정보예요. 수정은 관리자만 할 수 있어요 (기존 보안 규칙 그대로 적용).

alter table public.players add column if not exists number int  check (number between 0 and 99);
alter table public.players add column if not exists foot   text check (foot in ('오른발','왼발','양발'));
alter table public.players add column if not exists intro  text check (char_length(intro) <= 100);
alter table public.players add column if not exists birth  date check (birth between '1900-01-01' and '2100-12-31');

-- 주발 점수 (왼발·오른발 각각 0~5점)
alter table public.players add column if not exists foot_left  int check (foot_left  between 0 and 5);
alter table public.players add column if not exists foot_right int check (foot_right between 0 and 5);
