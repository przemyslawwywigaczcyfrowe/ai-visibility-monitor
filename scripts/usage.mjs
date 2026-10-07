// Panel usage for the owner only. Pulls anonymous, aggregated stats from GoatCounter (no cookies,
// no personal data) and writes them encrypted with a separate owner password to data/usage.enc.
// Run by .github/workflows/usage.yml.
//
// Env: GOATCOUNTER_CODE (site code, e.g. eig-ai-visibility), GOATCOUNTER_TOKEN (API token with
// "read statistics"), OWNER_PASSWORD (not the panel password, so other users cannot read it).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { deriveKey, encryptJson, ITERATIONS } from './lib.mjs';

const { GOATCOUNTER_TOKEN: TOKEN, OWNER_PASSWORD: PASS } = process.env;
const CODE = process.env.GOATCOUNTER_CODE || ((JSON.parse(readFileSync('config/config.json', 'utf8')).analytics || {}).goatcounter);
if (!CODE || !TOKEN || !PASS) { console.log('GOATCOUNTER_CODE, GOATCOUNTER_TOKEN or OWNER_PASSWORD missing, usage not updated.'); process.exit(0); }

const API = `https://${CODE}.goatcounter.com/api/v0`;
const DAYS = 90;
const end = new Date(), start = new Date(Date.now() - (DAYS - 1) * 864e5);
const d = x => x.toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(path, params) {
  const q = new URLSearchParams(Object.assign({ start: d(start), end: d(end) }, params || {}));
  for (let i = 0; i < 4; i++) {
    const res = await fetch(`${API}${path}?${q}`, { headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } });
    if (res.status === 429) { await sleep(2000 * (i + 1)); continue; }
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
  throw new Error(`${path}: rate limited`);
}

const total = await get('/stats/total');
const hits = [];
for (let offset = 0, more = true; more && offset < 1000; offset += 100) {
  const r = await get('/stats/hits', { limit: 100, daily: true, ...(offset ? { offset } : {}) });
  hits.push(...(r.hits || [])); more = !!r.more; if (!r.more) break;
  await sleep(300);
}
const lists = {};
for (const page of ['browsers', 'systems', 'locations', 'sizes']) {
  try { lists[page] = (await get('/stats/' + page, { limit: 20 })).stats || []; } catch (e) { lists[page] = []; console.log('skip', page, e.message); }
  await sleep(300);
}

const usage = {
  updated: new Date().toISOString(), start: d(start), end: d(end),
  total: { count: total.total, events: total.total_events, days: (total.stats || []).map(s => [s.day, s.daily]) },
  hits: hits.map(h => ({ path: h.path, title: h.title, event: !!h.event, count: h.count, days: (h.stats || []).map(s => [s.day, s.daily]) })),
  browsers: lists.browsers.map(s => [s.name, s.count]), systems: lists.systems.map(s => [s.name, s.count]),
  locations: lists.locations.map(s => [s.name, s.count]), sizes: lists.sizes.map(s => [s.name || s.id, s.count])
};

mkdirSync('data', { recursive: true });
if (!existsSync('data/owner-salt.json')) writeFileSync('data/owner-salt.json', JSON.stringify({ salt: randomBytes(16).toString('base64'), iterations: ITERATIONS }, null, 2) + '\n');
const salt = JSON.parse(readFileSync('data/owner-salt.json', 'utf8'));
const key = await deriveKey(PASS, salt.salt, salt.iterations);
writeFileSync('data/usage.enc', await encryptJson(key, usage) + '\n');
console.log(`Usage saved: ${usage.total.count} visits, ${usage.hits.length} paths, ${d(start)} to ${d(end)}`);
