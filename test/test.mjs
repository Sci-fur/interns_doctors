import fs from 'fs';
import { buildCtx, generate, preflight } from '../js/generator.js';
import { validate, trySwap, computeStats, slotsOf } from '../js/rules.js';
const r = f => JSON.parse(fs.readFileSync(new URL('../data/' + f, import.meta.url)));
const db = { interns: r('interns.json'), placements: r('placements.json'), history: r('history.json'), rosters: [] };
// treat all interns' gender as set for the test
const inp = { name: 'Test', start: '2026-11-09', end: '2026-12-08' };
const ctx = buildCtx(db);
console.log('preflight:', preflight(ctx, inp));
const t0 = Date.now();
const { roster, stats, outdoorPending } = generate(ctx, inp);
console.log('ms', Date.now() - t0, 'days', roster.days.length, 'warnings', roster.warnings.length, 'violations', roster.violations.length, 'outdoorPending', outdoorPending);
console.log(roster.warnings.slice(0, 5), roster.violations.slice(0, 5));
const vals = Object.entries(stats).filter(([id]) => db.interns.find(i => i.id === id).active);
const sp = fn => { const v = vals.map(([, s]) => fn(s)); return [Math.min(...v), Math.max(...v)]; };
console.log('E+N total min/max', sp(s => s.evening + s.night), 'night', sp(s => s.night), 'friday', sp(s => s.friday), 'wedN', sp(s => s.wedNight), 'thuN', sp(s => s.thuNight));
// swap test: pick two evening emergency doctors on different days
const d1 = roster.days[2], d2 = roster.days[10];
const res = trySwap(roster, ctx, { id: d1.emergency.E[0], date: d1.date }, { id: d2.emergency.E[0], date: d2.date });
console.log('swap result ok?', res.ok, res.problems.slice(0, 3));
// a swap that must fail: swap an emergency night person with indoor morning person
const bad = trySwap(roster, ctx, { id: d1.emergency.N[0], date: d1.date }, { id: d2.indoor.M[0], date: d2.date });
console.log('bad swap ok?', bad.ok, bad.problems.slice(0, 3));
if (roster.violations.length || roster.warnings.length) process.exit(1);
