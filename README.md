# Intern Duty Roster (GitHub Pages, no server, no MongoDB)

Plain JavaScript (ES modules) – **no build step**. Data lives in `data/*.json` inside the repo ("file-system database").

## Deploy
1. Create a GitHub repo, push this folder.
2. Settings → Pages → Deploy from branch → `main` / root.
3. Open `https://<user>.github.io/<repo>/`.

## Guide
Press **❓ Guide** (top right) for a step-by-step tour of every screen (Bangla). It can also switch on Admin mode to show the admin screens.

## Admin
Click **Admin** (top right). Admin tabs: New Roster, Interns, Placements & Leave, Swap, Save/Settings.
Edits are kept as a local draft in the browser. To publish them, open **Save / Settings**, enter owner, repo,
branch and a *fine-grained personal access token* (only this repo, permission **Contents: Read and write**) and press
**Save changes to GitHub** (it commits the JSON files). Without a token use **Download backup JSON** and commit manually.
NOTE: a static site cannot truly hide the admin screen – protection = only people with the token/repo access can save.
If the repo is public, intern names/groups/genders in `data/` are public too.

## Workflow for a new roster
1. Interns tab – verify gender (pre-filled from names, unconfirmed), mark inactive if needed.
2. Placements tab – add Medicine / Pedi placements for the new period, leaves, and carry-over nights.
3. New Roster – set start date (end = +1 month), Auto-generate, check 0 conflicts, Save, then Save/Settings → push.
4. Rosters tab → choose Outdoor / Indoor / Emergency → Print / Save PDF.

## Rules implemented (js/rules.js, js/generator.js)
- Outdoor: 1 doctor/day Sat–Thu, none Friday, each doctor once per cycle (history tracked).
- Indoor: only doctors placed in Medicine; M/E/N 1 each, Friday morning 2.
- Emergency: Evening 2 (any gender mix), Night 2 (male-male or female-female, different groups); Pedi doctors excluded.
- One duty per person per day across all rosters; after any night duty next day off; Wednesday night → Thursday + Friday off.
- Fairness: E+N totals, nights, Friday, Wed-night and Thu-night counts are balanced using all saved rosters + opening balances.
- Swap: admin only; blocked if it creates any new rule violation.

`npm test` runs the generator test; `node test/ui-smoke.mjs` runs a fake-DOM UI test.
