// Drives the whole tour with a minimal fake DOM (checks it never throws and visits every tab).
const mk = () => { const e = { style: {}, className: '', innerHTML: '', classList: { add() {}, remove() {} }, children: {}, remove() { e.removed = true; }, appendChild() {}, addEventListener(t, h) { e.h = h; }, querySelector(s) { return e.children[s] ||= mk(); }, getBoundingClientRect: () => ({ top: 10, left: 10, width: 100, height: 40 }), scrollIntoView() {} }; return e; };
let root; global.document = { createElement: () => root = mk(), body: mk(), getElementById: () => null, contains: () => true, querySelector: () => mk(), addEventListener() {}, removeEventListener() {} };
global.addEventListener = () => {}; global.removeEventListener = () => {}; global.innerHeight = 800; global.confirm = () => true; global.requestAnimationFrame = f => f();
const { startTour } = await import('../js/tour.js'); const seen = new Set(); let admin = false, tab = 'rosters';
startTour({ tab: () => tab, goto: t => { tab = t; seen.add(t); }, admin: () => admin, setAdmin: v => admin = v });
let n = 0; const r = root; while (!r.removed && n < 50) { r.h({ target: { closest: () => ({ dataset: { t: 'next' } }) } }); n++; }
console.log('admin enabled:', admin, '| clicks to finish:', n, '| tabs visited:', [...seen].join(','));
