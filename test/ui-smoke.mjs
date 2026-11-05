// Fake-DOM smoke test: renders every tab and drives generate / save / swap.
import fs from 'fs';
const els = {}; const handlers = {};
global.document = { querySelector: s => els[s] ||= { innerHTML: '' }, addEventListener: (t, h) => handlers[t] = h };
const ls = {}; global.localStorage = { getItem: k => ls[k] ?? null, setItem: (k, v) => ls[k] = v, removeItem: k => delete ls[k] };
global.fetch = async u => { const p = u.split('?')[0]; return fs.existsSync(p) ? { ok: true, json: async () => JSON.parse(fs.readFileSync(p)) } : { ok: false }; };
global.location = { reload() {} }; global.window = { print() {} }; global.confirm = () => true;
await import('../js/app.js'); await new Promise(r => setTimeout(r, 100));
const click = (act, data = {}) => handlers.click({ target: { closest: () => ({ dataset: { act, ...data }, disabled: false }) }, preventDefault() {} });
const change = (b, value, type = 'text') => handlers.change({ target: { dataset: { b }, value, type, checked: value } });
localStorage.setItem('roster_admin', '1'); await click('admin'); // toggles OFF->ON? starts from stored value
for (const t of ['rosters', 'stats', 'generate', 'interns', 'placements', 'swap', 'settings']) { await click('tab', { k: t }); if (els['#app'].innerHTML.includes('undefined') || els['#app'].innerHTML.length < 50) throw new Error('bad render ' + t); }
await click('tab', { k: 'generate' }); await click('confirmall'); await click('generate');
console.log('preview ok:', els['#app'].innerHTML.includes('All rules satisfied'));
await click('saveroster'); await click('sheet', { k: 'indoor' });
console.log('saved rosters render:', els['#app'].innerHTML.includes('MEDICINE INDOOR DUTY ROSTER'));
await click('tab', { k: 'swap' });
const r = JSON.parse(ls.roster_draft_v1).db.rosters[0];
change('sw:rid', r.id); change('sw:aId', r.days[2].emergency.E[0]); change('sw:aDate', r.days[2].date); change('sw:bId', r.days[10].emergency.E[0]); change('sw:bDate', r.days[10].date);
await click('checkswap'); console.log('swap check shows:', els['#app'].innerHTML.includes('Swap is valid') ? 'valid' : 'blocked');
await click('tab', { k: 'stats' }); console.log('stats rendered:', els['#app'].innerHTML.includes('Profiles') || els['#app'].innerHTML.includes('Wed night'));
