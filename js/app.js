import { db, load, persist, dirty, deleted, discardDraft, rosterPath, removeRoster, ghConf, setGhConf, pushAll, downloadBackup } from './store.js';
import { buildCtx, generate, preflight } from './generator.js';
import { startTour } from './tour.js';
import { trySwap, computeStats, slotsOf, monthEnd, addDays, isFri, dow, SLOT_LABEL } from './rules.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = d => d.split('-').reverse().join('/');
const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const by = id => db.interns.find(i => i.id === id);
const nm = id => by(id) ? 'Dr. ' + by(id).name : id;
const badge = id => by(id)?.batch === 6 ? '<span class="b6">6th</span>' : '';
const cell = ids => ids.map(id => `<div>${esc(nm(id))}${badge(id)}</div>`).join('') || '<span class="mut">—</span>';
const opts = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');
const internOpts = sel => opts([['', '— select —'], ...db.interns.filter(i => i.active).map(i => [i.id, i.name])], sel);

const S = { tab: 'rosters', rid: null, sheet: 'outdoor', admin: localStorage.getItem('roster_admin') === '1', preview: null, profile: null, msg: '', form: null, swap: { rid: '', aId: '', aDate: '', bId: '', bDate: '', res: null } };
const PUBLIC = [['rosters', 'Rosters'], ['stats', 'Profiles & Fairness']];
const ADMIN = [['generate', '➕ New Roster'], ['interns', 'Interns'], ['placements', 'Placements & Leave'], ['swap', 'Swap'], ['settings', 'Save / Settings']];

const HEAD = {
  rosters: ['Duty Rosters', 'View, switch and print the Outdoor, Indoor and Emergency sheets.'],
  stats: ['Profiles & Fairness', 'Duty counts for every doctor across all saved rosters.'],
  generate: ['Create a New Roster', 'Pick a period, auto-generate a conflict-free roster and save it.'],
  interns: ['Interns', 'Verify names, batches, groups and gender before generating a roster.'],
  placements: ['Placements & Leave', 'Departments, leave and carry-over nights used by the generator.'],
  swap: ['Duty Swap', 'Exchange two duties without breaking any roster rule.'],
  settings: ['Save / Settings', 'Push local changes to GitHub or download a backup JSON.'],
};

const META = {
  outdoor: { label: 'Outdoor', dept: 'DEPARTMENT OF MEDICINE • OUTPATIENT DEPARTMENT (মেডিসিন বহির্বিভাগ / OPD)', t: 'MEDICINE OUTDOOR DUTY ROSTER (মেডিসিন আউটডোর ডিউটি রোস্টার)', sub: 'সময়: সকাল ০৮:০০ – দুপুর ০২:০০ | কার্যদিবস: শনি – বৃহস্পতি (শুক্রবার বন্ধ)', sig: ['In-Charge (Medicine OPD)', 'Head of Department (Medicine)', 'Director / Superintendent'] },
  indoor: { label: 'Indoor', dept: 'DEPARTMENT OF MEDICINE — INDOOR / IN-PATIENT WARD (মেডিসিন ইনডোর বিভাগ)', t: 'MEDICINE INDOOR DUTY ROSTER (মেডিসিন ইনডোর ডিউটি রোস্টার)', sub: 'সকাল (M) ০৮:০০–১৪:০০ | সন্ধ্যা (E) ১৪:০০–২০:০০ | নাইট (N) ২০:০০–০৮:০০', sig: ['In-Charge (Medicine Indoor)', 'Head of Department (Medicine)', 'Resident Medical Officer (RMO)'] },
  emergency: { label: 'Emergency', dept: 'DEPARTMENT OF EMERGENCY & CASUALTY SERVICES', t: 'EMERGENCY DUTY ROSTER (ইমারজেন্সি ডিউটি রোস্টার)', sub: 'Evening: 02:00 PM – 08:00 PM | Night: 08:00 PM – 08:00 AM (Next Day)', sig: ['In-Charge (Emergency)', 'Head of Department', 'Director / Superintendent'] },
};

function sheet(r, kind) {
  const m = META[kind];
  const head = { outdoor: '<th>SL</th><th>Date</th><th>Day</th><th>দায়িত্বপ্রাপ্ত মেডিকেল অফিসার</th>', indoor: '<th>SL</th><th>Date & Day</th><th>Morning (M)</th><th>Evening (E)</th><th>Night (N)</th>', emergency: '<th>SL</th><th>Date & Day</th><th>Evening Shift</th><th>Night Shift</th>' }[kind];
  const rows = r.days.map((d, i) => {
    const f = isFri(d.date), s = slotsOf(d), dd = WD[dow(d.date)];
    const dt = kind === 'outdoor' ? `<td>${i + 1}</td><td><b>${fmt(d.date)}</b></td><td>${dd}</td>` : `<td>${i + 1}</td><td><b>${fmt(d.date)}</b><br><span class="mut">${dd}${f ? ' (HOLIDAY)' : ''}</span></td>`;
    let body;
    if (kind === 'outdoor') body = f ? '<td class="holiday">● সাপ্তাহিক ছুটি (শুক্রবার ওপিডি বন্ধ)</td>' : `<td>${cell(s.OUT)}</td>`;
    else if (kind === 'indoor') body = `<td>${cell(s.IM)}</td><td>${cell(s.IE)}</td><td>${cell(s.IN)}</td>`;
    else body = `<td>${cell(s.EE)}</td><td>${cell(s.EN)}</td>`;
    return `<tr class="${f ? 'fri' : ''}">${dt}${body}</tr>`;
  }).join('');
  return `<div id="roster-output" class="sheet printable-area"><div class="sheet-h"><img class="sheet-logo" src="public/rangamati_medical_logo.png" alt="Rangamati Medical College logo"><div class="hosp">RANGAMATI MEDICAL COLLEGE HOSPITAL</div><div class="dept">${m.dept}</div><div class="ttl">${m.t}</div>
  <div class="per">Period: ${r.days.length} days, ${fmt(r.start)} – ${fmt(r.end)} &nbsp;|&nbsp; ${m.sub}</div></div>
  <div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
  <div class="sigs">${m.sig.map(x => `<div>${x}<br>Rangamati Medical College Hospital</div>`).join('')}</div></div>`;
}
const sheetTabs = () => `<div class="noprint row">${Object.entries(META).map(([k, m]) => `<button class="btn ${S.sheet === k ? 'pri' : ''}" data-act="sheet" data-k="${k}">${m.label}</button>`).join('')}<button class="btn" data-act="print">🖨 Print / Save PDF</button></div>`;

const pages = {
  rosters() {
    if (!db.rosters.length) return `<div class="card empty-state"><img class="empty-logo" src="public/rangamati_medical_logo.png" alt="Rangamati Medical College logo"><h3>No roster published yet</h3><p>When an admin creates and saves a roster, it will appear here automatically.</p>${S.admin ? '<p class="mut">Open <b>New Roster</b> to generate the first one.</p>' : ''}</div>`;
    const list = [...db.rosters].sort((a, b) => b.start.localeCompare(a.start));
    const r = db.rosters.find(x => x.id === S.rid) || list[0];
    return `<div class="noprint row"><label>Roster<select data-b="rid">${opts(list.map(x => [x.id, `${x.name} (${fmt(x.start)} – ${fmt(x.end)})`]), r.id)}</select></label>
      ${S.admin ? `<button class="btn danger" data-act="delroster" data-id="${r.id}">Delete roster</button>` : ''}</div>${sheetTabs()}${sheet(r, S.sheet)}`;
  },
  stats() {
    const st = computeStats(db.rosters, db.history.balances, db.interns);
    const act = db.interns.filter(i => i.active).sort((a, b) => b.batch - a.batch || a.group.localeCompare(b.group));
    const doneOut = Object.fromEntries((db.history.outdoor || []).map(o => [o.internId, o.date]));
    const rows = act.map(i => { const s = st[i.id]; return `<tr><td><a href="#" data-act="profile" data-id="${i.id}">${esc(i.name)}</a>${badge(i.id)}</td><td>${i.batch}${i.group}</td><td>${i.gender || '?'}</td><td>${s.evening}</td><td>${s.night}</td><td><b>${s.evening + s.night}</b></td><td>${s.friday}</td><td>${s.wedNight}</td><td>${s.thuNight}</td><td>${s.outdoor || doneOut[i.id] ? '✔' : ''}</td></tr>`; }).join('');
    let prof = '';
    if (S.profile) {
      const i = by(S.profile), lines = [];
      db.rosters.forEach(r => r.days.forEach(d => { const s = slotsOf(d); for (const k in s) if (s[k].includes(i.id)) lines.push(`<tr><td>${fmt(d.date)}</td><td>${WD[dow(d.date)]}</td><td>${SLOT_LABEL[k]}</td></tr>`); }));
      prof = `<div class="card"><h3>${esc(nm(i.id))} <span class="mut">Batch ${i.batch}, Group ${i.group}</span></h3><table><tr><th>Date</th><th>Day</th><th>Duty</th></tr>${lines.join('') || '<tr><td colspan=3>No duty in saved rosters</td></tr>'}</table></div>`;
    }
    return `<div class="card scroll"><table><thead><tr><th>Doctor</th><th>Grp</th><th>G</th><th>Evening</th><th>Night</th><th>E+N</th><th>Friday</th><th>Wed night</th><th>Thu night</th><th>Outdoor done</th></tr></thead><tbody>${rows}</tbody></table></div>${prof}`;
  },
  generate() {
    const last = [...db.rosters].sort((a, b) => b.end.localeCompare(a.end))[0];
    const f = S.form ||= { name: '', start: last ? addDays(last.end, 1) : '2026-11-09', end: '', attempts: 150, seed: 1 };
    if (!f.end) f.end = monthEnd(f.start);
    let out = '';
    if (S.preview) {
      const { roster: r, stats, pf, outdoorPending } = S.preview;
      const v = Object.values(stats).map(s => s.evening + s.night), n = Object.values(stats).map(s => s.night), fr = Object.values(stats).map(s => s.friday);
      const rg = a => `${Math.min(...a)}–${Math.max(...a)}`;
      out = `${pf.map(x => `<div class="warn">${esc(x)}</div>`).join('')}
        ${r.warnings.concat(r.violations).map(x => `<div class="err">${esc(x)}</div>`).join('') || '<div class="ok">All rules satisfied – 0 conflicts.</div>'}
        <div class="mut">Cumulative E+N per doctor: ${rg(v)} · Night: ${rg(n)} · Friday duty: ${rg(fr)} · Outdoor doctors still pending for next roster: ${outdoorPending}</div>
        <div class="row" style="margin-top:8px"><button class="btn pri" data-act="saveroster">💾 Save this roster</button></div>${sheetTabs()}${sheet(r, S.sheet)}`;
    }
    return `<div class="card"><h3 style="margin-top:0">Create new roster</h3><div class="row">
      <label>Name<input data-b="form:name" value="${esc(f.name)}" placeholder="e.g. Nov–Dec 2026"></label>
      <label>Start date<input type="date" data-b="form:start" value="${f.start}"></label>
      <label>End date (default: +1 month)<input type="date" data-b="form:end" value="${f.end}"></label>
      <label>Attempts<input type="number" data-b="form:attempts" value="${f.attempts}" style="width:80px"></label>
      <label>Seed<input type="number" data-b="form:seed" value="${f.seed}" style="width:70px"></label>
      <button class="btn pri" data-act="generate">⚙ Auto-generate</button></div>
      <div class="mut">Uses: Interns, Placements (Medicine / Pedi), Leave, carry-over nights and all saved rosters (for fairness). Change seed to get a different valid roster.</div></div>${out}`;
  },
  interns() {
    const rows = db.interns.map((i, x) => `<tr><td><input data-b="in:${x}:name" value="${esc(i.name)}"></td>
      <td><select data-b="in:${x}:batch">${opts([[6, '6th'], [7, '7th']], i.batch)}</select></td>
      <td><input data-b="in:${x}:group" value="${esc(i.group)}" style="width:50px"></td>
      <td><select data-b="in:${x}:gender">${opts([['', '?'], ['M', 'Male'], ['F', 'Female']], i.gender)}</select></td>
      <td><input type="checkbox" data-b="in:${x}:genderConfirmed" ${i.genderConfirmed ? 'checked' : ''}></td>
      <td><input type="checkbox" data-b="in:${x}:active" ${i.active ? 'checked' : ''}></td></tr>`).join('');
    return `<div class="card"><div class="warn">Genders were pre-filled from names only and are <b>unconfirmed</b> – please verify every row, then tick “Confirmed”.</div>
      <div class="row"><button class="btn" data-act="addintern">+ Add intern</button><button class="btn" data-act="confirmall">✔ Confirm all genders</button></div>
      <div class="scroll"><table><thead><tr><th>Name</th><th>Batch</th><th>Group</th><th>Gender</th><th>Confirmed</th><th>Active</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  },
  placements() {
    const dl = ['Medicine', 'Pedi', 'Surgery', 'Obs & Gyn', 'Periphery', 'Ortho', 'ENT', 'Eye', 'Anesthesia', 'Skin', 'General Surgery'];
    const pr = db.placements.map((p, x) => `<tr><td><select data-b="pl:${x}:internId">${internOpts(p.internId)}</select></td><td><input list="depts" data-b="pl:${x}:dept" value="${esc(p.dept)}"></td><td><input type="date" data-b="pl:${x}:from" value="${p.from}"></td><td><input type="date" data-b="pl:${x}:to" value="${p.to}"></td><td><button class="btn danger" data-act="del" data-t="placements" data-i="${x}">✕</button></td></tr>`).join('');
    const lv = db.history.leaves.map((p, x) => `<tr><td><select data-b="lv:${x}:internId">${internOpts(p.internId)}</select></td><td><input type="date" data-b="lv:${x}:from" value="${p.from}"></td><td><input type="date" data-b="lv:${x}:to" value="${p.to}"></td><td><button class="btn danger" data-act="del" data-t="leaves" data-i="${x}">✕</button></td></tr>`).join('');
    const pn = db.history.nights.map((p, x) => `<tr><td><select data-b="pn:${x}:internId">${internOpts(p.internId)}</select></td><td><input type="date" data-b="pn:${x}:date" value="${p.date}"></td><td><button class="btn danger" data-act="del" data-t="nights" data-i="${x}">✕</button></td></tr>`).join('');
    return `<datalist id="depts">${dl.map(d => `<option>${d}</option>`).join('')}</datalist>
    <div class="card"><h3 style="margin-top:0">Department placements</h3><div class="mut">Only <b>Medicine</b> (Indoor eligible) and <b>Pedi</b> (no Emergency) change the roster. Others are for record.</div>
      <div class="scroll"><table><thead><tr><th>Doctor</th><th>Dept</th><th>From</th><th>To</th><th></th></tr></thead><tbody>${pr}</tbody></table></div><button class="btn" data-act="addpl">+ Add placement</button></div>
    <div class="card"><h3 style="margin-top:0">Leave / unavailable</h3><div class="scroll"><table><thead><tr><th>Doctor</th><th>From</th><th>To</th><th></th></tr></thead><tbody>${lv}</tbody></table></div><button class="btn" data-act="addlv">+ Add leave</button></div>
    <div class="card"><h3 style="margin-top:0">Carry-over nights (nights before the new roster starts)</h3><div class="mut">Needed so a doctor with a night on the day before the roster is kept off on day 1 (and Wed-night rule).</div>
      <div class="scroll"><table><thead><tr><th>Doctor</th><th>Night date</th><th></th></tr></thead><tbody>${pn}</tbody></table></div><button class="btn" data-act="addpn">+ Add night</button></div>`;
  },
  swap() {
    const s = S.swap, r = db.rosters.find(x => x.id === s.rid);
    const dates = r ? r.days.map(d => [d.date, `${fmt(d.date)} ${WD[dow(d.date)]}`]) : [];
    const res = s.res ? (s.res.ok ? '<div class="ok">✔ Swap is valid – no rule broken.</div><button class="btn pri" data-act="applyswap">Apply swap</button>' : s.res.problems.map(p => `<div class="err">${esc(p)}</div>`).join('')) : '';
    return `<div class="card"><h3 style="margin-top:0">Duty swap (admin only)</h3><div class="mut">A and B exchange their duties. The system blocks the swap if it breaks any rule (night→off, Wed-night, gender, group, placement…).</div>
      <div class="row"><label>Roster<select data-b="sw:rid">${opts([['', '— select —'], ...db.rosters.map(x => [x.id, x.name])], s.rid)}</select></label></div>
      <div class="row"><label>Doctor A<select data-b="sw:aId">${internOpts(s.aId)}</select></label><label>A's duty date<select data-b="sw:aDate">${opts([['', '—'], ...dates], s.aDate)}</select></label>
      <label>Doctor B<select data-b="sw:bId">${internOpts(s.bId)}</select></label><label>B's duty date<select data-b="sw:bDate">${opts([['', '—'], ...dates], s.bDate)}</select></label>
      <button class="btn pri" data-act="checkswap">Check swap</button></div>${res}</div>`;
  },
  settings() {
    const c = ghConf(), n = dirty.size + deleted.size;
    return `<div class="card"><h3 style="margin-top:0">Save to GitHub</h3><div class="${n ? 'warn' : 'ok'}">${n ? `${n} file(s) changed locally and not yet saved: ${[...dirty, ...deleted].map(esc).join(', ')}` : 'Everything is saved.'}</div>
      <div class="row"><label>Owner<input data-b="gh:owner" value="${esc(c.owner)}"></label><label>Repo<input data-b="gh:repo" value="${esc(c.repo)}"></label><label>Branch<input data-b="gh:branch" value="${esc(c.branch)}" style="width:90px"></label>
      <label>Fine-grained token (Contents: read/write)<input type="password" data-b="gh:token" value="${esc(c.token)}" style="width:280px"></label></div>
      <div class="row"><button class="btn pri" data-act="push">⬆ Save changes to GitHub</button><button class="btn" data-act="backup">Download backup JSON</button><button class="btn danger" data-act="discard">Discard local changes</button></div>
      <div class="mut">The token is kept only in this browser. GitHub Pages republishes ~1 minute after saving.</div></div>`;
  },
};

function render() {
  const tabs = [...PUBLIC, ...(S.admin ? ADMIN : [])];
  $('#nav').innerHTML = tabs.map(([k, l]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${l}</button>`).join('');
  $('#mode').innerHTML = `<button class="btn" data-act="tour">❓ Guide</button> <button class="btn ${S.admin ? 'admin-on' : ''}" data-act="admin">${S.admin ? 'Admin mode: ON' : 'Admin'}</button>`;
  const n = dirty.size + deleted.size;
  const h = HEAD[S.tab];
  $('#app').innerHTML = (h ? `<div class="page-head noprint"><div><h2>${h[0]}</h2><p>${h[1]}</p></div></div>` : '') + (S.msg ? `<div class="${S.msg.startsWith('✔') ? 'ok' : 'err'} noprint">${esc(S.msg)}</div>` : '') + (S.admin && n ? `<div class="warn noprint">${n} unsaved change(s) – open “Save / Settings” to push them to GitHub.</div>` : '') + pages[S.tab]();
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return; e.preventDefault();
  const a = b.dataset.act, d = b.dataset; S.msg = '';
  try {
    if (a === 'tab') { S.tab = d.k; S.preview = null; }
    else if (a === 'admin') { S.admin = !S.admin; localStorage.setItem('roster_admin', S.admin ? '1' : '0'); if (!S.admin && !PUBLIC.some(t => t[0] === S.tab)) S.tab = 'rosters'; }
    else if (a === 'tour') { startTour({ tab: () => S.tab, goto: t => { S.tab = t; S.preview = null; S.msg = ''; render(); }, admin: () => S.admin, setAdmin: v => { S.admin = v; localStorage.setItem('roster_admin', v ? '1' : '0'); render(); } }); return; }
    else if (a === 'sheet') S.sheet = d.k;
    else if (a === 'print') { window.print(); return; }
    else if (a === 'profile') S.profile = d.id;
    else if (a === 'delroster') { if (confirm('Delete this roster?')) { removeRoster(d.id); S.rid = null; } }
    else if (a === 'generate') {
      const f = S.form, ctx = buildCtx(db, f.start);
      const res = generate(ctx, { name: f.name, start: f.start, end: f.end }, { attempts: +f.attempts || 150, seed: +f.seed || 1 });
      S.preview = { ...res, pf: preflight(ctx, f) };
    }
    else if (a === 'saveroster') {
      const r = S.preview.roster; db.rosters = db.rosters.filter(x => x.id !== r.id); db.rosters.push(r);
      persist(rosterPath(r.id), 'data/rosters/index.json'); S.rid = r.id; S.tab = 'rosters'; S.preview = null; S.msg = '✔ Roster saved locally. Open “Save / Settings” to push it to GitHub.';
    }
    else if (a === 'addintern') { db.interns.push({ id: 'i' + Date.now().toString(36), name: 'New Doctor', batch: 7, group: 'A', gender: '', genderConfirmed: false, active: true }); persist('data/interns.json'); }
    else if (a === 'confirmall') { db.interns.forEach(i => { if (i.gender) i.genderConfirmed = true; }); persist('data/interns.json'); }
    else if (a === 'addpl') { db.placements.push({ internId: '', dept: 'Medicine', from: '', to: '' }); persist('data/placements.json'); }
    else if (a === 'addlv') { db.history.leaves.push({ internId: '', from: '', to: '' }); persist('data/history.json'); }
    else if (a === 'addpn') { db.history.nights.push({ internId: '', date: '' }); persist('data/history.json'); }
    else if (a === 'del') { const t = d.t === 'placements' ? db.placements : db.history[d.t]; t.splice(+d.i, 1); persist(d.t === 'placements' ? 'data/placements.json' : 'data/history.json'); }
    else if (a === 'checkswap') {
      const s = S.swap, r = db.rosters.find(x => x.id === s.rid);
      s.res = !r || !s.aId || !s.bId || !s.aDate || !s.bDate ? { ok: false, problems: ['Select roster, both doctors and both dates.'] } : trySwap(r, buildCtx(db), { id: s.aId, date: s.aDate }, { id: s.bId, date: s.bDate });
    }
    else if (a === 'applyswap') { const s = S.swap; db.rosters = db.rosters.map(r => r.id === s.rid ? s.res.roster : r); persist(rosterPath(s.rid)); s.res = null; S.msg = '✔ Swap applied (saved locally – push from Save / Settings).'; }
    else if (a === 'push') { b.disabled = true; await pushAll(); S.msg = '✔ Saved to GitHub. The site updates in about a minute.'; }
    else if (a === 'backup') downloadBackup();
    else if (a === 'discard') { if (confirm('Discard ALL unsaved local changes?')) discardDraft(); }
  } catch (err) { S.msg = err.message; }
  render();
});

document.addEventListener('change', e => {
  const t = e.target, k = t.dataset.b; if (!k) return;
  const v = t.type === 'checkbox' ? t.checked : t.value, [p, i, f] = k.split(':');
  if (p === 'rid') S.rid = v;
  else if (p === 'form') { S.form[i] = v; if (i === 'start') S.form.end = monthEnd(v); }
  else if (p === 'in') { db.interns[+i][f] = f === 'batch' ? +v : v; persist('data/interns.json'); }
  else if (p === 'pl') { db.placements[+i][f] = v; persist('data/placements.json'); }
  else if (p === 'lv') { db.history.leaves[+i][f] = v; persist('data/history.json'); }
  else if (p === 'pn') { db.history.nights[+i][f] = v; persist('data/history.json'); }
  else if (p === 'sw') { S.swap[i] = v; S.swap.res = null; }
  else if (p === 'gh') { setGhConf({ ...ghConf(), [i]: v }); return; }
  render();
});

load().then(hasDraft => { if (hasDraft) S.msg = '✔ Showing your unsaved local changes.'; render(); });
