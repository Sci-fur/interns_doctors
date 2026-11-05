import { addDays, dow, isFri, range, emptyDay, deptOn, onLeave, nightMap, isOff, isNight, groupKey, computeStats, validate, SLOT_LABEL } from './rules.js';

const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const shuffle = (a, r) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function attempt(ctx, inp, rnd) {
  const { interns, placements, leaves, priorNights, stats0, outdoorDone } = ctx;
  const act = interns.filter(i => i.active);
  const st = {}; act.forEach(i => st[i.id] = { ...stats0[i.id], last: null });
  const nights = nightMap([], priorNights);
  const pending = shuffle(act.filter(i => !outdoorDone.has(i.id)).map(i => i.id), rnd);
  const days = [], warn = [];
  for (const date of range(inp.start, inp.end)) {
    const f = isFri(date), w = dow(date), day = emptyDay(date), busy = new Set();
    const free = i => !busy.has(i.id) && !isOff(nights, i.id, date) && !onLeave(leaves, i.id, date);
    const med = i => deptOn(placements, i.id, date) === 'Medicine';
    const emg = i => deptOn(placements, i.id, date) !== 'Pedi';
    const cost = (i, k) => {
      const s = st[i.id]; let c = 10 * (s.evening + s.night);
      if (isNight(k)) { c += 6 * s.night; if (w === 3) c += 8 * s.wedNight; if (w === 4) c += 8 * s.thuNight; }
      if (f) c += 8 * s.friday;
      if (k === 'IM') c += 3 * s.morning;
      if (s.last === addDays(date, -1)) c += 2;
      return c + rnd() * 4;
    };
    const take = (i, k, list) => {
      list.push(i.id); busy.add(i.id); const s = st[i.id]; s.last = date;
      if (k === 'IE' || k === 'EE') s.evening++;
      if (isNight(k)) { s.night++; if (w === 3) s.wedNight++; if (w === 4) s.thuNight++; if (!nights.has(date)) nights.set(date, new Set()); nights.get(date).add(i.id); }
      if (k === 'IM') s.morning++;
      if (k === 'OUT') s.outdoor++;
      if (w === 5 && k !== 'OUT') s.friday++;
    };
    const one = (k, list, elig) => {
      const c = act.filter(i => elig(i) && free(i)).map(i => [cost(i, k), i]).sort((a, b) => a[0] - b[0]);
      if (c.length) take(c[0][1], k, list); else warn.push(`${date}: ${SLOT_LABEL[k]} could not be filled`);
    };
    one('IN', day.indoor.N, med); one('IE', day.indoor.E, med);
    for (let n = f ? 2 : 1; n--;) one('IM', day.indoor.M, med);
    // Emergency night: same gender, different groups
    const pool = act.filter(i => emg(i) && free(i) && i.gender).map(i => [i, cost(i, 'EN')]);
    let bp = null;
    for (let a = 0; a < pool.length; a++) for (let b = a + 1; b < pool.length; b++) {
      const [x, cx] = pool[a], [y, cy] = pool[b];
      if (x.gender !== y.gender || groupKey(x) === groupKey(y)) continue;
      if (!bp || cx + cy < bp[2]) bp = [x, y, cx + cy];
    }
    if (bp) { take(bp[0], 'EN', day.emergency.N); take(bp[1], 'EN', day.emergency.N); } else warn.push(`${date}: Emergency Night pair could not be filled`);
    one('EE', day.emergency.E, emg); one('EE', day.emergency.E, emg);
    if (!f && pending.length) {
      const idx = pending.findIndex(id => free(act.find(x => x.id === id)));
      if (idx >= 0) { const [id] = pending.splice(idx, 1); take(act.find(x => x.id === id), 'OUT', day.outdoor); }
      else warn.push(`${date}: Outdoor could not be filled`);
    }
    days.push(day);
  }
  return { days, warn, st, pendingLeft: pending };
}

const score = r => {
  const sp = fn => { const v = Object.values(r.st).map(fn); return Math.max(...v) - Math.min(...v); };
  return r.warn.length * 1e6 + 100 * sp(s => s.evening + s.night) + 40 * sp(s => s.night) + 30 * sp(s => s.friday) + 25 * sp(s => s.wedNight) + 25 * sp(s => s.thuNight);
};

export function buildCtx(db, excludeRosterId) {
  const rosters = db.rosters.filter(r => r.id !== excludeRosterId);
  const outdoorDone = new Set([...(db.history.outdoor || []).map(o => o.internId), ...rosters.flatMap(r => r.days.flatMap(d => d.outdoor))]);
  const act = db.interns.filter(i => i.active);
  if (act.length && act.every(i => outdoorDone.has(i.id))) outdoorDone.clear(); // new outdoor cycle
  return {
    interns: db.interns, placements: db.placements, leaves: db.history.leaves || [], priorNights: db.history.nights || [],
    stats0: computeStats(rosters, db.history.balances || {}, db.interns), outdoorDone,
  };
}

export function preflight(ctx, inp) {
  const out = [], act = ctx.interns.filter(i => i.active);
  const noG = act.filter(i => !i.gender); if (noG.length) out.push(`Gender missing for: ${noG.map(i => i.name).join(', ')} (they cannot be given Emergency night)`);
  const un = act.filter(i => i.gender && !i.genderConfirmed).length; if (un) out.push(`${un} interns have unconfirmed gender – please verify in the Interns tab`);
  for (const d of range(inp.start, inp.end)) { const n = act.filter(i => deptOn(ctx.placements, i.id, d) === 'Medicine').length; if (n < 6) { out.push(`${d}: only ${n} interns in Medicine placement – Indoor needs at least ~6`); break; } }
  return out;
}

export function generate(ctx, inp, { attempts = 150, seed = 1 } = {}) {
  let best = null;
  for (let a = 0; a < attempts; a++) { const r = attempt(ctx, inp, mulberry(seed * 1000 + a)); const s = score(r); if (!best || s < best.s) best = { r, s }; }
  const roster = { id: inp.start, name: inp.name || `Roster ${inp.start}`, start: inp.start, end: inp.end, days: best.r.days, warnings: best.r.warn };
  roster.violations = validate(roster, ctx);
  return { roster, stats: computeStats([roster], ctx.stats0, ctx.interns), outdoorPending: best.r.pendingLeft.length };
}
