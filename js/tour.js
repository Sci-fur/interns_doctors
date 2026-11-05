// Guided tour: spotlights real UI elements and explains them step by step.
const STEPS = [
  { title: 'স্বাগতম! 👋', text: 'এই গাইডে রোস্টার দেখা, প্রিন্ট করা, নতুন রোস্টার বানানো, ডাক্তারের তথ্য ঠিক করা, swap করা এবং GitHub-এ সেভ করার পুরো ধাপ দেখানো হবে। <b>Next</b> চাপুন বা কিবোর্ডের ← → ব্যবহার করুন। বন্ধ করতে <b>Esc</b>।', tab: 'rosters' },
  { title: 'ট্যাব সমূহ', sel: '#nav', text: '<b>Rosters</b> ও <b>Profiles &amp; Fairness</b> সবাই দেখতে পারে। Admin mode চালু থাকলে আরও পাঁচটি ট্যাব দেখা যায়: New Roster, Interns, Placements &amp; Leave, Swap, Save / Settings।' },
  { title: 'রোস্টার বেছে নিন', tab: 'rosters', sel: 'select[data-b="rid"]', text: 'এখান থেকে রোস্টার বেছে নিন। নতুন রোস্টার সেভ হলে এই তালিকায় যোগ হয়। (এখনো কোনো রোস্টার না থাকলে এই ধাপটি ফাঁকা দেখাবে।)' },
  { title: 'তিনটি আলাদা শিট', tab: 'rosters', sel: '[data-act="sheet"]', text: '<b>Outdoor</b>, <b>Indoor</b> ও <b>Emergency</b> – তিনটি আলাদা শিট। বোতামে চাপলে শিট বদলায়।' },
  { title: 'শিট কীভাবে পড়বেন', tab: 'rosters', sel: '.sheet', text: 'শুক্রবারের সারি লালচে। Outdoor-এ শুক্রবার ছুটি। Indoor-এ শুক্রবার সকালে ২ জন। নামের পাশে <b>6th</b> লেবেল মানে 6th batch। Emergency-তে সন্ধ্যায় ২ জন (ছেলে-মেয়ে মিশ্র চলে), রাতে ২ জন (শুধু ছেলে-ছেলে বা মেয়ে-মেয়ে, ভিন্ন গ্রুপ)।' },
  { title: 'প্রিন্ট / PDF', tab: 'rosters', sel: '[data-act="print"]', text: 'চাপলে শুধু বর্তমান শিটটি প্রিন্ট হয় (হেডার ও সই-ব্লক সহ)। প্রিন্ট ডায়ালগে <b>Save as PDF</b> বেছে PDF বানানো যায়। তিনটি শিট আলাদা আলাদা প্রিন্ট করতে হবে।' },
  { title: 'Profiles & Fairness', tab: 'stats', sel: '#app table', text: 'প্রত্যেক ডাক্তারের Evening, Night, মোট E+N, Friday ডিউটি, Wed night, Thu night এবং Outdoor হয়েছে কি না। সব সেভ করা রোস্টার থেকে হিসাব হয়। নতুন রোস্টার এই সংখ্যা দেখে কম ডিউটি পাওয়া ডাক্তারকে আগে ডিউটি দেয়, তাই ফেয়ারনেস বজায় থাকে।' },
  { title: 'ব্যক্তিগত প্রোফাইল', tab: 'stats', sel: '#app table a', text: 'যেকোনো নামে ক্লিক করলে ওই ডাক্তারের নিজস্ব প্রোফাইল (কোন তারিখে কী ডিউটি) টেবিলের নিচে দেখা যায়।' },
  { title: 'Admin বোতাম', sel: '#mode button', text: 'এটি চালু করলে এডিটের ট্যাবগুলো দেখা যায়। মনে রাখবেন, এটি সত্যিকারের পাসওয়ার্ড নয়। সেভ করতে GitHub token লাগে, তাই token ছাড়া কেউ ডাটা বদলে পাবলিশ করতে পারবে না।' },
  { admin: 1, title: 'Interns – ডাক্তারের তালিকা', tab: 'interns', sel: '[data-act="confirmall"]', text: 'নাম, batch, group ও gender ঠিক করুন। Gender এখন নাম দেখে আন্দাজ করা (unconfirmed), যাচাই করে <b>Confirmed</b> টিক দিন বা <b>Confirm all</b> চাপুন। <b>Active</b> বন্ধ করলে ওই ডাক্তার নতুন রোস্টারে আসবেন না। নতুন ডাক্তারের জন্য <b>+ Add intern</b>।' },
  { admin: 1, title: 'Placements – কে কোন বিভাগে', tab: 'placements', sel: '#app .card', text: 'কোন ডাক্তার কোন বিভাগে কোন তারিখ থেকে কোন তারিখ পর্যন্ত। <b>Medicine</b>-এ থাকলে Indoor ডিউটি পান, <b>Pedi</b>-তে থাকলে Emergency পান না। প্রতিবার নতুন রোস্টারের আগে এটি হালনাগাদ করুন।' },
  { admin: 1, title: 'Leave – ছুটি', tab: 'placements', sel: '[data-act="addlv"]', text: 'ডাক্তারের ছুটির সময় যোগ করুন। ওই সময়ে কোনো ডিউটি দেওয়া হবে না।' },
  { admin: 1, title: 'Carry-over nights', tab: 'placements', sel: '[data-act="addpn"]', text: 'নতুন রোস্টার শুরুর আগের দিনগুলোতে কারা নাইট করেছেন (যেমন ৫–৮ নভেম্বর) তা এখানে দিন, যাতে প্রথম দিনে তাঁদের off রাখা যায়।' },
  { admin: 1, title: 'New Roster – তারিখ', tab: 'generate', sel: '[data-b="form:start"]', text: 'শুরুর তারিখ দিন। শেষ তারিখ নিজে থেকে এক মাস পরে বসে (বদলানো যায়)। একটি নাম দিন।' },
  { admin: 1, title: 'Auto-generate', tab: 'generate', sel: '[data-act="generate"]', text: 'চাপলে সিস্টেম অনেকবার চেষ্টা করে সবচেয়ে ন্যায্য রোস্টারটি বেছে নেয়। <b>Seed</b> বদলালে আরেকটি বৈধ রোস্টার পাবেন।' },
  { admin: 1, title: 'ফলাফল পরীক্ষা ও সেভ', tab: 'generate', text: 'সবুজ বক্স <b>All rules satisfied</b> মানে কোনো নিয়ম ভাঙেনি। লাল বক্স থাকলে কারণ লেখা থাকে। হলুদ সতর্কতা (যেমন gender অনিশ্চিত) আগে ঠিক করুন। সব ঠিক থাকলে <b>Save this roster</b> চাপুন। এটি শুধু আপনার ব্রাউজারে সেভ হয়, GitHub-এ পাঠাতে Settings ট্যাব লাগবে।' },
  { admin: 1, title: 'Swap – ডিউটি বদল', tab: 'swap', sel: '[data-act="checkswap"]', text: 'রোস্টার, দুজন ডাক্তার (A, B) ও তাঁদের তারিখ বেছে <b>Check swap</b> চাপুন। কোনো নিয়ম ভাঙলে কারণসহ আটকে দেবে (যেমন নাইটের পরদিন off, ইনডোর/আউটডোর ডিউটি আছে, gender বা group মিলছে না)। ঠিক থাকলে <b>Apply swap</b>। শুধু admin এটি করতে পারে।' },
  { admin: 1, title: 'GitHub-এ সেভ', tab: 'settings', sel: '[data-b="gh:owner"]', text: 'GitHub owner, repo, branch ও token দিন (token শুধু এই repo-র জন্য, <b>Contents: Read and write</b>)। <b>Save changes to GitHub</b> চাপলে সব পরিবর্তন commit হয় এবং প্রায় এক মিনিটে সাইট আপডেট হয়। Token শুধু এই ব্রাউজারে থাকে।' },
  { admin: 1, title: 'Backup ও Discard', tab: 'settings', sel: '[data-act="backup"]', text: 'Token না থাকলে <b>Download backup JSON</b> করে হাতে commit করুন। <b>Discard local changes</b> চাপলে সেভ না করা পরিবর্তন বাদ যায়।' },
  { title: 'যে নিয়মগুলো সিস্টেম মানে', tab: 'rosters', text: '• প্রতিদিন একজনের একটির বেশি ডিউটি নয়<br>• নাইটের পরদিন off; বুধবার নাইট হলে বৃহস্পতি ও শুক্র off<br>• Emergency রাতে একই গ্রুপের দুজন নয়, ছেলে-মেয়ে একসাথে নয়<br>• Pedi-তে থাকলে Emergency নেই; Indoor শুধু Medicine placement-এর ডাক্তাররা<br>• Outdoor-এ প্রত্যেকে একবার করে<br>• Evening/Night, Friday, Wed/Thu night সমানভাবে ভাগ' },
  { title: 'কাজের ধারা', text: '১) Interns যাচাই → ২) Placements ও Leave হালনাগাদ → ৩) New Roster → Auto-generate → ৪) Save this roster → ৫) Settings থেকে GitHub-এ Save → ৬) Rosters থেকে Print।<br><br>যেকোনো সময় উপরের <b>❓ Guide</b> চাপলে আবার দেখতে পারবেন।' },
];

export function startTour(api) {
  if (document.getElementById('tour')) return;
  if (!api.admin() && confirm('Admin অংশও দেখাতে Admin mode চালু করব?\nOK = হ্যাঁ (সব দেখাও), Cancel = শুধু সাধারণ অংশ')) api.setAdmin(true);
  const steps = STEPS.filter(s => !s.admin || api.admin());
  let i = 0, el = null;
  const root = document.createElement('div'); root.id = 'tour';
  root.innerHTML = '<div class="tour-catch"></div><div class="tour-hl"></div><div class="tour-box"></div>';
  document.body.appendChild(root);
  const hl = root.querySelector('.tour-hl'), box = root.querySelector('.tour-box');

  const place = () => {
    if (!el || !document.contains(el)) { hl.style.display = 'none'; root.classList.add('nohl'); box.className = 'tour-box mid'; return; }
    root.classList.remove('nohl');
    const r = el.getBoundingClientRect();
    Object.assign(hl.style, { display: 'block', top: r.top - 6 + 'px', left: r.left - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
    box.className = 'tour-box ' + (r.top > innerHeight / 2 ? 'top' : 'bot');
  };
  const show = () => {
    const s = steps[i];
    if (s.tab && api.tab() !== s.tab) api.goto(s.tab);
    el = s.sel ? document.querySelector(s.sel) : null;
    if (el) el.scrollIntoView({ block: el.getBoundingClientRect().height > innerHeight * 0.6 ? 'start' : 'center' });
    box.innerHTML = `<div class="tour-n">ধাপ ${i + 1} / ${steps.length}</div><h3>${s.title}</h3><div class="tour-t">${s.text}</div>
      <div class="tour-b"><button class="btn" data-t="skip">বন্ধ করুন</button><span style="flex:1"></span>
      <button class="btn" data-t="prev" ${i === 0 ? 'disabled' : ''}>← Back</button><button class="btn pri" data-t="next">${i === steps.length - 1 ? 'শেষ ✔' : 'Next →'}</button></div>`;
    place(); requestAnimationFrame(place);
  };
  const close = () => { root.remove(); document.removeEventListener('keydown', key); removeEventListener('scroll', place, true); removeEventListener('resize', place); };
  const next = () => { if (i >= steps.length - 1) close(); else { i++; show(); } };
  const prev = () => { if (i > 0) { i--; show(); } };
  const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev(); };
  root.addEventListener('click', e => { const t = e.target.closest('[data-t]')?.dataset.t; if (t === 'next') next(); else if (t === 'prev') prev(); else if (t === 'skip') close(); });
  document.addEventListener('keydown', key); addEventListener('scroll', place, true); addEventListener('resize', place);
  show();
}
