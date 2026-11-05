// Pure rule helpers (no DOM) – shared by generator, validator, swap and UI.
export const SLOT_LABEL = { IM: 'Indoor Morning', IE: 'Indoor Evening', IN: 'Indoor Night', EE: 'Emergency Evening', EN: 'Emergency Night', OUT: 'Outdoor' };
export const isNight = s => s === 'IN' || s === 'EN';
const D = i => new Date(i + 'T00:00:00Z');
export const addDays = (i, n) => { const d = D(i); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const dow = i => D(i).getUTCDay();            // 0=Sun ... 5=Fri
export const isFri = i => dow(i) === 5;
export const range = (a, b) => { const o = []; for (let d = a; d <= b; d = addDays(d, 1)) o.push(d); return o; };
export const monthEnd = s => { const d = D(s); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
export const slotsOf = day => ({ IM: day.indoor.M, IE: day.indoor.E, IN: day.indoor.N, EE: day.emergency.E, EN: day.emergency.N, OUT: day.outdoor });
export const emptyDay = date => ({ date, indoor: { M: [], E: [], N: [] }, emergency: { E: [], N: [] }, outdoor: [] });
export const deptOn = (pl, id, date) => { const p = pl.find(x => x.internId === id && x.from <= date && date <= x.to); return p ? p.dept : null; };
export const onLeave = (lv, id, date) => lv.some(l => l.internId === id && l.from <= date && date <= l.to);
export const groupKey = i => i.batch + i.group;

// date -> Set(internId) of people who had a NIGHT duty that date
export function nightMap(rosters, prior = []) {
  const m = new Map(); const add = (d, id) => { if (!m.has(d)) m.set(d, new Set()); m.get(d).add(id); };
  prior.forEach(n => add(n.date, n.internId));
  for (const r of rosters) for (const day of r.days) { const s = slotsOf(day); for (const k of ['IN', 'EN']) s[k].forEach(id => add(day.date, id)); }
  return m;
}
// Night on d-1 => off on d.  Wednesday night => Thursday off AND Friday off.
export function isOff(nights, id, date) {
  if (nights.get(addDays(date, -1))?.has(id)) return true;
  if (dow(date) === 5 && nights.get(addDays(date, -2))?.has(id)) return true;
  return false;
}

export function validate(roster, ctx) {
  const { interns, placements, leaves = [], priorNights = [] } = ctx;
  const by = Object.fromEntries(interns.map(i => [i.id, i]));
  const n = id => by[id] ? 'Dr. ' + by[id].name : id;
  const nights = nightMap([roster], priorNights); const v = [];
  for (const day of roster.days) {
    const f = isFri(day.date), s = slotsOf(day), d = day.date;
    const need = { IM: f ? 2 : 1, IE: 1, IN: 1, EE: 2, EN: 2 };
    const seen = new Map();
    for (const k in s) {
      if (k === 'OUT') { if (s[k].length > (f ? 0 : 1)) v.push(`${d}: too many Outdoor doctors`); }
      else if (s[k].length !== need[k]) v.push(`${d}: ${SLOT_LABEL[k]} needs ${need[k]}, has ${s[k].length}`);
      for (const id of s[k]) {
        if (seen.has(id)) v.push(`${d}: ${n(id)} has two duties (${SLOT_LABEL[seen.get(id)]} & ${SLOT_LABEL[k]})`);
        seen.set(id, k);
        if (isOff(nights, id, d)) v.push(`${d}: ${n(id)} must be off (after night duty) but has ${SLOT_LABEL[k]}`);
        if (onLeave(leaves, id, d)) v.push(`${d}: ${n(id)} is on leave but has ${SLOT_LABEL[k]}`);
        const dp = deptOn(placements, id, d);
        if (k[0] === 'I' && dp !== 'Medicine') v.push(`${d}: ${n(id)} is not placed in Medicine (${SLOT_LABEL[k]})`);
        if (k[0] === 'E' && dp === 'Pedi') v.push(`${d}: ${n(id)} is in Pedi, cannot do Emergency`);
      }
    }
    if (s.EN.length === 2) {
      const [a, b] = s.EN.map(id => by[id]);
      if (!a?.gender || a.gender !== b?.gender) v.push(`${d}: Emergency night pair must be male-male or female-female`);
      if (a && b && groupKey(a) === groupKey(b)) v.push(`${d}: Emergency night pair must be from different groups`);
    }
  }
  return v;
}

export function computeStats(rosters, balances, interns) {
  const z = () => ({ evening: 0, night: 0, friday: 0, wedNight: 0, thuNight: 0, morning: 0, outdoor: 0 });
  const st = {}; interns.forEach(i => st[i.id] = { ...z(), ...(balances?.[i.id] || {}) });
  for (const r of rosters) for (const day of r.days) {
    const s = slotsOf(day), w = dow(day.date);
    for (const k in s) for (const id of s[k]) {
      const t = st[id]; if (!t) continue;
      if (k === 'IE' || k === 'EE') t.evening++;
      if (isNight(k)) { t.night++; if (w === 3) t.wedNight++; if (w === 4) t.thuNight++; }
      if (k === 'IM') t.morning++;
      if (k === 'OUT') t.outdoor++;
      if (w === 5 && k !== 'OUT') t.friday++;
    }
  }
  return st;
}

// Admin-only swap: A and B exchange their duties. Allowed only if it creates NO new rule violation.
export function trySwap(roster, ctx, a, b) {
  const find = (x) => { const day = roster.days.find(d => d.date === x.date); if (!day) return null; const s = slotsOf(day); for (const k in s) if (s[k].includes(x.id)) return { day, k }; return null; };
  const fa = find(a), fb = find(b);
  if (!fa) return { ok: false, problems: ['Person A has no duty on that date'] };
  if (!fb) return { ok: false, problems: ['Person B has no duty on that date'] };
  const before = validate(roster, ctx);
  const clone = JSON.parse(JSON.stringify(roster));
  const sw = (x, from, to) => { const day = clone.days.find(d => d.date === x.date); const s = slotsOf(day); const list = s[from.k]; list[list.indexOf(x.id)] = to; };
  sw(a, fa, b.id); sw(b, fb, a.id);
  const after = validate(clone, ctx);
  const problems = after.filter(m => !before.includes(m));
  return problems.length ? { ok: false, problems } : { ok: true, roster: clone, problems: [] };
}
