// 할라피뇨FC 선수 본인 사진 올리기·지우기 (Supabase Edge Function: player-photo)
// 로그인한 선수(비밀번호 4자리)의 토큰을 확인한 뒤, 자동 실행용 관리자 계정(AUTO_EMAIL/AUTO_PASSWORD)으로 저장
//  body: {token, image: base64, type: 'image/webp' | 'image/jpeg'}  → 사진 바꾸기
//        {token, remove: true}                                       → 사진 지우기
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://gudwubeutvkhjrsardtc.supabase.co';
const PUBLIC_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? 'sb_publishable_DD4LX04ysEDt7T0ELcdo8Q_Cl1hSPPE';
const BUCKET = 'player-photos';
const MAX_BYTES = 1024 * 1024;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), {status, headers: {...CORS, 'Content-Type': 'application/json'}});

Deno.serve(async (req) => {
  if(req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => ({}));
  const opt = {auth: {persistSession: false}};

  // 1) 선수 로그인 확인
  const pub = createClient(SUPABASE_URL, PUBLIC_KEY, opt);
  const me = await pub.rpc('player_me', {p_token: body.token});
  const pid = me.data?.player_id;
  if(me.error || !pid) return json({ok: false, msg: '다시 로그인해 주세요'}, 401);

  // 2) 저장은 자동 실행용 관리자 계정으로
  const sb = createClient(SUPABASE_URL, PUBLIC_KEY, opt);
  const {error: le} = await sb.auth.signInWithPassword({email: Deno.env.get('AUTO_EMAIL') ?? '', password: Deno.env.get('AUTO_PASSWORD') ?? ''});
  if(le) return json({ok: false, msg: '사진 저장 계정으로 로그인하지 못했어요. 운영진에게 알려 주세요'}, 500);
  const cur = await sb.from('players').select('photo').eq('id', pid).single();
  const old: string | null = cur.data?.photo ?? null;

  if(body.remove){
    const u = await sb.from('players').update({photo: null}).eq('id', pid);
    if(u.error) return json({ok: false, msg: '사진을 지우지 못했어요'}, 500);
    if(old) await sb.storage.from(BUCKET).remove([old]);
    return json({ok: true, photo: null});
  }

  const type = body.type === 'image/jpeg' ? 'image/jpeg' : body.type === 'image/webp' ? 'image/webp' : null;
  if(!type || typeof body.image !== 'string') return json({ok: false, msg: '사진 형식이 올바르지 않아요'}, 400);
  let bytes: Uint8Array;
  try{ bytes = Uint8Array.from(atob(body.image), c => c.charCodeAt(0)); }catch{ return json({ok: false, msg: '사진을 읽지 못했어요'}, 400); }
  if(bytes.length > MAX_BYTES) return json({ok: false, msg: '사진이 너무 커요 (1MB까지)'}, 400);

  const path = `p${pid}-${Date.now()}.${type === 'image/webp' ? 'webp' : 'jpg'}`;
  const up = await sb.storage.from(BUCKET).upload(path, bytes, {contentType: type, cacheControl: '31536000', upsert: false});
  if(up.error) return json({ok: false, msg: '사진을 올리지 못했어요: ' + up.error.message}, 500);
  const u = await sb.from('players').update({photo: path}).eq('id', pid);
  if(u.error){ await sb.storage.from(BUCKET).remove([path]); return json({ok: false, msg: '사진 정보를 저장하지 못했어요'}, 500); }
  if(old) await sb.storage.from(BUCKET).remove([old]);
  return json({ok: true, photo: path});
});
