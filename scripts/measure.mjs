// Daily measurement. Asks every prompt of every market in every engine, analyses the answers
// and writes encrypted results to data/. Run by .github/workflows/measure.yml.
//
// Env: OPENROUTER_KEY, DATA_KEY (required), GEMINI_API_KEY (optional: engines with
// provider "google" go straight to the Gemini API; without the key they fall back to OpenRouter).
// Optional: MARKETS="PL,UK", PROMPTS="PL01,UK02".
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { buildRequest, parseResponse, buildGoogleRequest, parseGoogleResponse, analyse, shopsForMarket, dataKey, encryptJson, decryptJson } from './lib.mjs';

const KEY = process.env.OPENROUTER_KEY;
const GKEY = process.env.GEMINI_API_KEY;
if (!KEY || !(process.env.DATA_KEY || process.env.PANEL_PASSWORD)) { console.error('Missing OPENROUTER_KEY or DATA_KEY.'); process.exit(1); }

const CONCURRENCY = 10;
const MAX_ANSWER = 40000;
const cfg = JSON.parse(readFileSync('config/config.json', 'utf8'));
const onlyMarkets = process.env.MARKETS ? process.env.MARKETS.split(',') : null;
const onlyPrompts = process.env.PROMPTS ? process.env.PROMPTS.split(',') : null;

/* ---------- key and existing data ---------- */
mkdirSync('data/runs', { recursive: true });
const key = await dataKey();

let index = { runs: [], hist: [] };
if (existsSync('data/index.enc')) {
  // A wrong password must stop the run. Otherwise a new, empty index would replace the history.
  try { index = await decryptJson(key, readFileSync('data/index.enc', 'utf8')); }
  catch (e) { console.error('Cannot decrypt data/index.enc. Is DATA_KEY the same as before?'); process.exit(1); }
}

/* GitHub can start a scheduled run hours late. If someone already ran the measurement by hand
   today (Warsaw date), the scheduled run skips the day instead of paying for a second one. */
const today = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Warsaw' }).slice(0, 10);
if (process.env.EVENT === 'schedule' && index.runs.some(r => r.run.slice(0, 10) === today)) {
  console.log(`A run for ${today} already exists, scheduled run skipped.`);
  process.exit(0);
}

/* ---------- prompts ---------- */
const prompts = [];
for (const m of cfg.markets) {
  (cfg.prompts[m.code] || []).forEach((text, i) => {
    prompts.push({ market: m.code, id: m.code + String(i + 1).padStart(2, '0'), text, topic: cfg.topics[i] || '' });
  });
}
const tasks = [];
for (const p of prompts) {
  if (onlyMarkets && !onlyMarkets.includes(p.market)) continue;
  if (onlyPrompts && !onlyPrompts.includes(p.id)) continue;
  for (const e of cfg.engines) tasks.push({ p, e });
}

const now = new Date();
const run = now.toLocaleString('sv-SE', { timeZone: 'Europe/Warsaw' }).slice(0, 16);
const file = run.replace(' ', '_').replace(':', '');
console.log(`Run ${run}: ${tasks.length} calls`);

/* ---------- calls ---------- */
const marketBy = Object.fromEntries(cfg.markets.map(m => [m.code, m]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ask(t) {
  const m = marketBy[t.p.market];
  const google = t.e.provider === 'google' && GKEY && t.e.googleModel;
  const req = google ? buildGoogleRequest(t.p.text, t.e, m, GKEY) : buildRequest(t.p.text, t.e, m, KEY);
  let last = { error: 'not started' };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 180000);
      const res = await fetch(req.url, { ...req.init, signal: ctrl.signal });
      const text = await res.text();
      clearTimeout(timer);
      last = google ? parseGoogleResponse(res.status, text, t.e) : parseResponse(res.status, text);
      if (google) last.via = 'google';
      if (!last.error) break;
      if (/HTTP 4(00|01|02|03)/.test(last.error)) break;   // key, billing or limit problem, retry will not help
    } catch (e) { last = { error: String(e && e.message || e) }; }
    await sleep(3000 * (attempt + 1));
  }
  const a = last.error ? { pos: null, mentioned: [], ourUrl: '', domains: [] } : analyse(last.answer, last.sources, shopsForMarket(cfg.shops, t.p.market));
  return { t, r: last, a, time: new Date().toISOString() };
}

const results = [];
for (let i = 0; i < tasks.length; i += CONCURRENCY) {
  results.push(...await Promise.all(tasks.slice(i, i + CONCURRENCY).map(ask)));
  process.stdout.write('.');
}
console.log('');

const ok = results.filter(x => !x.r.error).length;
const cost = results.reduce((s, x) => s + (x.r.cost || 0), 0);
/* Google searches count against the 5,000 free a month; past that they cost 14 USD per 1,000. */
const googleSearches = results.filter(x => x.r.via === 'google').reduce((s, x) => s + (x.r.searches || 0), 0);
const month = run.slice(0, 7);
const monthSearches = index.runs.filter(r => r.run.slice(0, 7) === month).reduce((s, r) => s + (r.googleSearches || 0), 0) + googleSearches;
console.log(`Answers ${ok}/${results.length}, cost ${cost.toFixed(3)} USD` +
  (results.some(x => x.r.via === 'google') ? `, Google searches ${googleSearches} (this month ${monthSearches} of 5000 free)` : ''));
results.filter(x => x.r.error).slice(0, 5).forEach(x => console.log('  error', x.t.p.id, x.t.e.label, x.r.error));
if (!ok) { console.error('No answers, nothing saved.'); process.exit(1); }

/* ---------- save ---------- */
const details = {};
for (const x of results) {
  index.hist.push([run, x.t.p.id, x.t.e.label, x.a.pos, x.a.mentioned.join('; '), x.a.ourUrl ? 1 : 0, x.r.error ? 1 : 0]);
  details[x.t.p.id + '|' + x.t.e.label] = {
    time: x.time, model: x.r.model || x.t.e.model, pos: x.a.pos, mentioned: x.a.mentioned.join('; '), url: x.a.ourUrl,
    sources: x.a.domains.join(', '), answer: String(x.r.answer || '').slice(0, MAX_ANSWER), tokens: x.r.tokens || 0,
    cost: x.r.cost || 0, error: x.r.error || ''
  };
}
index.runs.push({ run, file, start: now.toISOString(), end: new Date().toISOString(), calls: results.length, ok, cost: Math.round(cost * 10000) / 10000,
  googleSearches, via: { openrouter: results.filter(x => x.r.via !== 'google').length, google: results.filter(x => x.r.via === 'google').length } });
index.engines = cfg.engines;
index.topics = cfg.topics;
index.prompts = prompts.map(p => ({ market: p.market, id: p.id, text: p.text, topic: p.topic }));
index.markets = cfg.markets.map(m => {
  const ours = cfg.shops.find(s => s.ours && s.market === m.code) || { name: m.code, domains: [], pattern: '' };
  return { code: m.code, name: m.name, city: m.city, store: ours.name, domains: ours.domains, pattern: ours.pattern };
});
index.updated = new Date().toISOString();

writeFileSync(`data/runs/${file}.enc`, await encryptJson(key, { run, details }) + '\n');
writeFileSync('data/index.enc', await encryptJson(key, index) + '\n');
console.log(`Saved data/runs/${file}.enc and data/index.enc`);
