// "File-system database": JSON files under /data in the repo.
// Reads: plain fetch (GitHub Pages). Writes: local draft + GitHub Contents API (needs admin token).
export const db = { interns: [], placements: [], history: { outdoor: [], nights: [], balances: {}, leaves: [] }, rosters: [] };
export const dirty = new Set();           // file paths changed locally
export const deleted = new Set();         // roster file paths to delete on save
const DRAFT = 'roster_draft_v1';

const j = async p => { try { const r = await fetch(p + '?t=' + Date.now()); return r.ok ? await r.json() : null; } catch { return null; } };

export async function load() {
  const draft = localStorage.getItem(DRAFT);
  if (draft) { const d = JSON.parse(draft); Object.assign(db, d.db); d.dirty.forEach(x => dirty.add(x)); d.deleted.forEach(x => deleted.add(x)); return true; }
  db.interns = await j('data/interns.json') || [];
  db.placements = await j('data/placements.json') || [];
  db.history = await j('data/history.json') || db.history;
  const idx = await j('data/rosters/index.json') || [];
  db.rosters = (await Promise.all(idx.map(r => j(`data/rosters/${r.id}.json`)))).filter(Boolean);
  return false;
}
export function persist(...paths) {
  paths.forEach(p => dirty.add(p));
  localStorage.setItem(DRAFT, JSON.stringify({ db, dirty: [...dirty], deleted: [...deleted] }));
}
export function discardDraft() { localStorage.removeItem(DRAFT); location.reload(); }
export const rosterPath = id => `data/rosters/${id}.json`;
export function removeRoster(id) { db.rosters = db.rosters.filter(r => r.id !== id); dirty.delete(rosterPath(id)); deleted.add(rosterPath(id)); persist('data/rosters/index.json'); }

const content = p => {
  if (p === 'data/interns.json') return db.interns;
  if (p === 'data/placements.json') return db.placements;
  if (p === 'data/history.json') return db.history;
  if (p === 'data/rosters/index.json') return db.rosters.map(({ id, name, start, end }) => ({ id, name, start, end })).sort((a, b) => a.start.localeCompare(b.start));
  return db.rosters.find(r => rosterPath(r.id) === p) ?? null;
};
export const ghConf = () => JSON.parse(localStorage.getItem('roster_gh') || '{"owner":"","repo":"","branch":"main","token":""}');
export const setGhConf = c => localStorage.setItem('roster_gh', JSON.stringify(c));
const why = (path, r) => r.status === 403 ? `${path}: 403 – the token cannot write to this repo. Open the token on GitHub → Resource owner = repo owner, Repository access includes this repo, and Repository permissions → Contents = Read and write.` : r.status === 401 ? `${path}: 401 – token is wrong or expired.` : r.status === 404 ? `${path}: 404 – check Owner/Repo/Branch spelling, and that the token can access this repo.` : r.status === 422 ? `${path}: 422 – branch name may be wrong or the file changed on GitHub; reload and try again.` : `${path}: ${r.status}`;
const b64 = s => btoa(unescape(encodeURIComponent(s)));

export async function pushAll() {
  const c = ghConf(); if (!c.owner || !c.repo || !c.token) throw new Error('Fill GitHub owner, repo and token in Settings first.');
  const H = { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json' };
  const getSha = async (url) => {   // never use a cached answer: GitHub caches GETs for ~60s
    const g = await fetch(`${url}?ref=${c.branch}&_=${Date.now()}`, { headers: H, cache: 'no-store' });
    return g.ok ? (await g.json()).sha : undefined;
  };
  const send = async (path, obj) => {
    const url = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}`;
    for (let tryNo = 0; tryNo < 3; tryNo++) {
      const sha = await getSha(url);
      let r;
      if (obj === null) { if (!sha) return; r = await fetch(url, { method: 'DELETE', headers: H, body: JSON.stringify({ message: `admin: delete ${path}`, sha, branch: c.branch }) }); }
      else r = await fetch(url, { method: 'PUT', headers: H, body: JSON.stringify({ message: `admin: update ${path}`, content: b64(JSON.stringify(obj, null, 1)), sha, branch: c.branch }) });
      if (r.ok) return;
      if (r.status !== 409 && r.status !== 422) throw new Error(why(path, r));   // 409/422 = stale sha -> retry
      await new Promise(res => setTimeout(res, 800));
    }
    throw new Error(`${path}: GitHub kept rejecting the update (sha conflict). Wait a minute and press Save again.`);
  };
  for (const p of [...dirty]) { await send(p, content(p)); dirty.delete(p); persist(); }
  for (const p of [...deleted]) { await send(p, null); deleted.delete(p); persist(); }
  dirty.clear(); deleted.clear(); localStorage.removeItem(DRAFT);
}
export function downloadBackup() {
  const blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'roster-backup.json'; a.click();
}
