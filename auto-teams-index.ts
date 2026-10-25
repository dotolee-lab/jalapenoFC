// 할라피뇨FC 자동 팀 구성 (Supabase Edge Function: auto-teams)
// 매주 금요일 18:00(한국 시간)에 예약 실행 → 이번 경기 '참석' 투표 인원으로 팀을 나눠 공개
//  · 9명 이하: 만들지 않음 · 10~14명: 2팀 · 15명 이상: 3팀
//  · 팀 나누는 방식은 사이트의 '팀 구성하기'와 같음 (index.html의 cost/balance/computeForms와 같은 내용)
// 실행 방법
//  · 예약 실행: x-cron-secret 헤더 = CRON_SECRET  → 자동 실행용 관리자 계정(AUTO_EMAIL/AUTO_PASSWORD)으로 로그인해서 처리
//  · 관리 탭 버튼: 로그인한 관리자의 토큰으로 처리 (body: {dry:true} = 미리 보기만, {force:true} = 이미 공개됐어도 다시)
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://gudwubeutvkhjrsardtc.supabase.co';
const PUBLIC_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? 'sb_publishable_DD4LX04ysEDt7T0ELcdo8Q_Cl1hSPPE';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), {status, headers: {...CORS, 'Content-Type': 'application/json'}});

/* ---------------- 규칙 ---------------- */
const MIN_PLAYERS = 10;
const teamCountFor = (n: number) => n <= 14 ? 2 : 3;

/* ---------------- 점수·밸런싱 (사이트와 같음) ---------------- */
const POSITIONS = ['공격', '미드', '수비'];
const ACTS: Record<string, number> = {'좋음': 1, '보통': 0.5, '나쁨': 0};
const SKILLS = ['s_pass', 's_dribble', 's_defense', 's_speed', 's_shoot'];
const TEAM_LETTERS = ['A', 'B', 'C'];
// deno-lint-ignore no-explicit-any
type P = any;
let useForm = true;
const gkBonus = (p: P) => (p.s_gk >= 1 && p.s_gk <= 5) ? (p.s_gk - 1) * 0.125 : 0;
const skillAvg = (p: P) => { const v = SKILLS.map(k => p[k]).filter(x => x >= 1 && x <= 5); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const skillBonus = (p: P) => { const a = skillAvg(p); return a === null ? 0 : (a - 3) * 0.5; };
const formBonus = (p: P) => useForm ? (p.form || 0) : 0;
const score = (p: P) => Math.round((p.grade + (ACTS[p.act] ?? 0.5) + skillBonus(p) + gkBonus(p) + formBonus(p)) * 100) / 100;
function normPos(v: unknown){
  const arr = (Array.isArray(v) ? v : String(v || '').split(',')).filter((x: string) => POSITIONS.includes(x));
  const uniq = POSITIONS.filter(x => arr.includes(x));
  return uniq.length ? uniq : ['미드'];
}
function shuffle<T>(a: T[]){ for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const sum = (t: P[]) => t.reduce((s, p) => s + score(p), 0);
const avg = (t: P[]) => t.length ? sum(t) / t.length : 0;
const REST_BONUS = 0.1;
const strengths = (teams: P[][]) => { const min = Math.min(...teams.map(t => t.length)); return teams.map(t => avg(t) + REST_BONUS * (t.length - min)); };
function variance(arr: number[]){ const m = arr.reduce((a, b) => a + b, 0) / arr.length; return arr.reduce((a, b) => a + (b - m) ** 2, 0); }
function cost(teams: P[][]){
  const s = variance(strengths(teams)) * 250;
  const pos = POSITIONS.reduce((acc, x) => acc + variance(teams.map(t => t.reduce((v, p) => v + (p.pos.includes(x) ? 1 / p.pos.length : 0), 0))), 0) * 3;
  const gk = variance(teams.map(t => t.filter(p => p.gk).length)) * 4
           + variance(teams.map(t => Math.max(0, ...t.map(p => p.gk ? (p.s_gk || 3) : 0)))) * 3;
  const size = variance(teams.map(t => t.length)) * 100;
  const sk = SKILLS.reduce((acc, k) => acc + variance(teams.map(t => t.length ? t.reduce((v, p) => v + (p[k] || 3), 0) / t.length : 0)), 0) * 18;
  return s + pos + gk + size + sk;
}
function snake(list: P[], n: number){
  const teams: P[][] = Array.from({length: n}, () => []);
  const sorted = shuffle(list.slice()).sort((a, b) => score(b) - score(a));
  sorted.forEach((p, i) => { const round = Math.floor(i / n), k = i % n; teams[round % 2 === 0 ? k : n - 1 - k].push(p); });
  return teams;
}
function improve(teams: P[][]){
  const n = teams.length;
  let best = cost(teams), improved = true, guard = 0;
  while(improved && guard++ < 300){
    improved = false;
    const pairs: number[][] = [];
    for(let a = 0; a < n; a++) for(let b = a + 1; b < n; b++) pairs.push([a, b]);
    for(const [a, b] of shuffle(pairs))
      for(const i of shuffle([...teams[a].keys()])) for(const j of shuffle([...teams[b].keys()])){
        const x = teams[a][i], y = teams[b][j];
        teams[a][i] = y; teams[b][j] = x;
        const c = cost(teams);
        if(c < best - 1e-9){ best = c; improved = true; }
        else { teams[a][i] = x; teams[b][j] = y; }
      }
  }
  return {teams, c: best};
}
function balance(list: P[], n: number){
  const results = [];
  for(let r = 0; r < 40; r++) results.push(improve(snake(list, n)));
  const min = Math.min(...results.map(x => x.c));
  const good = results.filter(x => x.c <= min + 1e-9);
  return good[Math.floor(Math.random() * good.length)].teams;
}
const DEFAULT_TACTIC_OF = (sport: string, n: number) => sport === 'soccer'
  ? ({8: '3-3-1', 9: '3-3-2', 10: '3-4-2'} as Record<number, string>)[n] || (n >= 11 ? '4-4-2' : '')
  : ({4: '2-2', 5: '2-1-2', 6: '2-2-2', 7: '3-2-2', 8: '3-3-2'} as Record<number, string>)[n] || '';

/* ---------------- 최근 폼 (사이트와 같음) ---------------- */
// deno-lint-ignore no-explicit-any
function computeForms(days: any[], games: any[], stats: any[], today: string){
  const dayResults = (dayId: number, team: string) => {
    const r = {w: 0, d: 0, l: 0};
    games.filter(g => g.day_id === dayId && (g.home === team || g.away === team)).forEach(gm => {
      const my = gm.home === team ? gm.home_score : gm.away_score, op = gm.home === team ? gm.away_score : gm.home_score;
      if(my > op) r.w++; else if(my < op) r.l++; else r.d++;
    });
    return r;
  };
  const formOf: Record<number, number> = {};
  const past = new Set(days.filter(d => d.played_on <= today).map(d => d.id));
  const dateOf = Object.fromEntries(days.map(d => [d.id, d.played_on]));
  const rows = stats.filter(r => past.has(r.day_id) && r.team);
  let tp = 0, tg = 0;
  rows.forEach(r => { const x = dayResults(r.day_id, r.team); const n = x.w + x.d + x.l; if(n){ tp += (r.goals || 0) + (r.assists || 0); tg += n; } });
  const teamAvg = tg ? tp / tg : 0;
  // deno-lint-ignore no-explicit-any
  const byPlayer: Record<number, any[]> = {};
  rows.forEach(r => (byPlayer[r.player_id] ||= []).push(r));
  Object.entries(byPlayer).forEach(([pid, list]) => {
    const recent = list.sort((a, b) => dateOf[b.day_id].localeCompare(dateOf[a.day_id])).slice(0, 3);
    let w = 0, d = 0, l = 0, pts = 0;
    recent.forEach(r => { const x = dayResults(r.day_id, r.team); w += x.w; d += x.d; l += x.l; pts += (r.goals || 0) + (r.assists || 0); });
    const gp = w + d + l;
    if(gp < 4) return;
    const rate = (w + d * 0.5) / gp, ppg = pts / gp;
    let v = 0;
    if(rate >= 0.65) v += 0.3; else if(rate <= 0.35) v -= 0.3;
    if(teamAvg > 0){ if(ppg >= teamAvg * 1.5) v += 0.2; else if(ppg <= teamAvg * 0.5) v -= 0.1; }
    formOf[+pid] = Math.round(v * 10) / 10;
  });
  return formOf;
}

/* ---------------- 날짜 (한국 시간) ---------------- */
const kstNow = () => new Date(Date.now() + 9 * 3600e3);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
// deno-lint-ignore no-explicit-any
function nextOccurrence(ev: any, from: string){
  const base = ev.event_date;
  if(!ev.repeat || ev.repeat === 'none' || base >= from) return base;
  if(ev.repeat === 'weekly') return addDays(base, Math.ceil(daysBetween(base, from) / 7) * 7);
  const step = ev.repeat === 'halfyear' ? 6 : 1;
  const [by, bm, bd] = base.split('-').map(Number);
  for(let k = step; k < 1200; k += step){
    const total = (bm - 1) + k, y = by + Math.floor(total / 12), m = total % 12 + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cand = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(bd, last)).padStart(2, '0')}`;
    if(cand >= from) return cand;
  }
  return base;
}
// 마감: 경기 날짜 직전 목요일 23:00 (한국 시간)
function voteDeadline(date: string){
  const dow = new Date(date + 'T12:00:00Z').getUTCDay();
  const back = ((dow - 4 + 7) % 7) || 7;
  return new Date(Date.parse(date + 'T00:00:00+09:00') - back * 864e5 + 23 * 3600e3);
}

/* ---------------- 실행 ---------------- */
Deno.serve(async (req) => {
  if(req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => ({}));
  const dry = !!body.dry, force = !!body.force, sport = body.sport === 'soccer' ? 'soccer' : 'futsal';

  // 1) 누가 불렀는지 확인
  const cronSecret = Deno.env.get('CRON_SECRET');
  const viaCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;
  let sb;
  if(viaCron){
    sb = createClient(SUPABASE_URL, PUBLIC_KEY, {auth: {persistSession: false}});
    const {error} = await sb.auth.signInWithPassword({email: Deno.env.get('AUTO_EMAIL') ?? '', password: Deno.env.get('AUTO_PASSWORD') ?? ''});
    if(error) return json({ok: false, msg: '자동 실행용 관리자 계정으로 로그인하지 못했어요 (AUTO_EMAIL / AUTO_PASSWORD 확인)'}, 500);
  } else {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const check = createClient(SUPABASE_URL, PUBLIC_KEY, {auth: {persistSession: false}});
    const {data} = token ? await check.auth.getUser(token) : {data: null};
    if(!data?.user) return json({ok: false, msg: '관리자만 실행할 수 있어요'}, 401);
    sb = createClient(SUPABASE_URL, PUBLIC_KEY, {auth: {persistSession: false}, global: {headers: {Authorization: `Bearer ${token}`}}});
  }

  const nowIso = new Date().toISOString();
  const log = async (o: Record<string, unknown>) => {
    if(dry) return;
    await sb.from('app_settings').upsert({key: sport === 'soccer' ? 'auto_teams_last_soccer' : 'auto_teams_last', value: {at: nowIso, by: viaCron ? 'auto' : 'admin', ...o}, updated_at: nowIso});
  };
  const done = async (o: Record<string, unknown>) => { await log(o); return json(o); };

  try{
    // 2) 켜져 있는지 (예약 실행일 때만 확인)
    const st = await sb.from('app_settings').select('key,value').in('key', ['auto_teams', 'use_form']);
    // deno-lint-ignore no-explicit-any
    const setting = (k: string) => (st.data || []).find((x: any) => x.key === k)?.value;
    useForm = setting('use_form') !== false;
    if(viaCron && setting('auto_teams')?.on === false) return json({ok: true, skipped: true, msg: '자동 팀 구성이 꺼져 있어요'});

    // 3) 대상 경기: 가장 가까운 '경기' 일정 (경기 당일 오전 11시가 지나면 다음 경기)
    const k = kstNow(), today = ymd(k);
    const from = k.getUTCHours() >= 11 ? addDays(today, 1) : today;
    const ev = await sb.from('events').select('event_date,event_time,kind,title,repeat,sport');
    if(ev.error) throw ev.error;
    const match = ev.data.filter(e => e.kind === '경기' && (!e.sport || e.sport === 'both' || e.sport === sport))
      .map(e => ({...e, next: nextOccurrence(e, from)})).filter(e => e.next >= from)
      .sort((a, b) => a.next.localeCompare(b.next) || (a.event_time || '').localeCompare(b.event_time || ''))[0];
    if(!match) return await done({ok: false, msg: '예정된 경기 일정이 없어요'});
    const date = match.next;

    // 4) 이미 이번 주에 공개했으면 건너뜀 (관리 탭에서 '지금 실행'은 덮어씀)
    const resultId = sport === 'soccer' ? 2 : 1;
    if(!force && !dry){
      const pub = await sb.from('team_results').select('created_at').eq('id', resultId).maybeSingle();
      if(pub.data && Date.parse(pub.data.created_at) > voteDeadline(date).getTime())
        return await done({ok: true, skipped: true, date, msg: '투표 마감 뒤에 이미 팀 구성을 공개해서 건너뛰었어요'});
    }

    // 5) 참석 인원
    const v = await sb.from('attendance_votes').select('player_id,status').eq('event_date', date).eq('sport', sport).eq('status', 'yes');
    if(v.error) throw v.error;
    const yesIds = new Set(v.data.map(x => x.player_id));
    const pl = await sb.from('players').select('id,name,pos,gk');
    if(pl.error) throw pl.error;
    let rt = await sb.from('player_ratings').select('player_id,grade,act,' + SKILLS.join(',') + ',s_gk');
    if(rt.error) rt = await sb.from('player_ratings').select('player_id,grade,act,' + SKILLS.join(','));
    if(rt.error) rt = await sb.from('player_ratings').select('player_id,grade,act');
    if(rt.error) throw rt.error;
    // deno-lint-ignore no-explicit-any
    const ratingOf = Object.fromEntries((rt.data as any[]).map(r => [r.player_id, r]));
    const attendees = pl.data.filter(p => yesIds.has(p.id));
    const n = attendees.length;
    if(n < MIN_PLAYERS) return await done({ok: false, date, n, msg: `참석 ${n}명이라 팀을 만들지 않았어요 (${MIN_PLAYERS}명 이상부터)`});

    // 6) 최근 폼
    const md = await sb.from('match_days').select('id,played_on,sport');
    const allDays = (md.data || []).filter(d => !('sport' in d) || (d.sport || 'futsal') === sport);
    const dayIds = new Set(allDays.map(d => d.id));
    const [gm, ps] = await Promise.all([
      sb.from('match_games').select('day_id,home,away,home_score,away_score'),
      sb.from('player_stats').select('day_id,player_id,team,goals,assists'),
    ]);
    const games = (gm.data || []).filter(g => dayIds.has(g.day_id)), stats = (ps.data || []).filter(s => dayIds.has(s.day_id));
    const formOf = computeForms(allDays, games, stats, today);
    const list = attendees.map(p => {
      const r = ratingOf[p.id] || {};
      return {id: p.id, name: p.name, pos: normPos(p.pos), gk: !!p.gk, grade: r.grade ?? 3, act: r.act ?? '보통',
        ...Object.fromEntries(SKILLS.map(k => [k, r[k] ?? null])), s_gk: r.s_gk ?? null, form: formOf[p.id] || 0};
    });

    // 7) 팀 나누기
    const count = teamCountFor(n);
    const teams = balance(list, count);
    const tactics = teams.map(t => DEFAULT_TACTIC_OF(sport, t.length));
    const summary = teams.map((t, i) => ({team: TEAM_LETTERS[i],
      players: t.map(p => ({name: p.name, pos: p.pos.join(',')}))}));
    const out = {ok: true, date, n, count, teams: summary, msg: `참석 ${n}명 → ${count}팀으로 ${dry ? '나눠 봤어요 (공개 안 함)' : '나눠서 공개했어요'}`};
    if(dry) return json(out);

    // 8) 공개 + 경기일 출석·팀 기록 + 출석 체크
    const pubRow = {id: resultId, teams: {teams: teams.map(t => t.map(p => [p.name, p.pos.join(','), p.gk ? 1 : 0])), tactics}, created_at: nowIso};
    const up = await sb.from('team_results').upsert(pubRow);
    if(up.error) throw up.error;
    let day = await sb.from('match_days').upsert({played_on: date, sport}, {onConflict: 'played_on,sport'}).select('id').single();
    if(day.error) day = await sb.from('match_days').upsert({played_on: date}, {onConflict: 'played_on'}).select('id').single();
    if(!day.error && day.data){
      const dayId = day.data.id;
      const rows = teams.flatMap((t, i) => t.map(p => ({day_id: dayId, player_id: p.id, team: TEAM_LETTERS[i]})));
      await sb.from('player_stats').upsert(rows, {onConflict: 'day_id,player_id'});
      const ids = new Set(rows.map(r => r.player_id));
      const old = await sb.from('player_stats').select('player_id,goals,assists,mvp').eq('day_id', dayId);
      const stale = (old.data || []).filter(r => !ids.has(r.player_id) && !r.goals && !r.assists && !r.mvp).map(r => r.player_id);
      if(stale.length) await sb.from('player_stats').delete().eq('day_id', dayId).in('player_id', stale);
    }
    await sb.from('players').update({attending: false}).gte('id', 0);
    await sb.from('players').update({attending: true}).in('id', [...yesIds]);
    return await done(out);
  }catch(e){
    const msg = (e as Error)?.message || String(e);
    return await done({ok: false, msg: '오류가 났어요: ' + msg});
  }
});
