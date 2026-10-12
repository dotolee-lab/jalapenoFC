-- 선수 프로필 사진 저장 공간 만들기
-- Supabase > SQL Editor 새 탭에 붙여넣고 Run 하세요. (다시 실행해도 괜찮아요)

-- 1) 사진 저장 공간 (누구나 볼 수 있음, 파일당 최대 1MB, 이미지 형식만)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-photos', 'player-photos', true, 1048576, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update
  set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/webp','image/jpeg','image/png'];

-- 2) 올리기·바꾸기·지우기는 관리자(로그인)만
drop policy if exists "photos_admin_select" on storage.objects;
drop policy if exists "photos_admin_insert" on storage.objects;
drop policy if exists "photos_admin_update" on storage.objects;
drop policy if exists "photos_admin_delete" on storage.objects;
create policy "photos_admin_select" on storage.objects for select to authenticated using (bucket_id = 'player-photos');
create policy "photos_admin_insert" on storage.objects for insert to authenticated with check (bucket_id = 'player-photos');
create policy "photos_admin_update" on storage.objects for update to authenticated using (bucket_id = 'player-photos') with check (bucket_id = 'player-photos');
create policy "photos_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'player-photos');

-- 3) 선수별 사진 파일 이름을 기억할 칸
alter table public.players add column if not exists photo text;
