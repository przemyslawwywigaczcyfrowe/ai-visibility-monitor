// Checklist sync: reads the checklist form answers (Google Sheet, service account as viewer),
// decrypts each change with the panel key and writes the shared state to data/checklist.enc.
// A change that does not decrypt was not made with the panel password and is skipped, so the public
// form cannot be used to tick items. The last change of an item (by its time) wins.
//
// Env: PANEL_PASSWORD, GOOGLE_SA_KEY (service account JSON or its private key).
// State: { v, upTo (sheet rows already read), updated, items: { PL: { "3.2": { s, by, at } } }, log: [last 300 changes] }
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createSign, webcrypto } from 'node:crypto';
import { deriveKey, encryptJson, decryptJson } from './lib.mjs';

const subtle = webcrypto.subtle;
const CFG = JSON.parse(readFileSync('config/config.json', 'utf8'));
const CHL = JSON.parse(readFileSync('config/checklist.json', 'utf8'));
const SHEET = CFG.checklist && CFG.checklist.sheetId;
const FILE = 'data/checklist.enc';
if (!SHEET) { console.log('No checklist sheet in config.json.'); process.exit(0); }
if (!process.env.PANEL_PASSWORD && !process.env.PANEL_KEY) { console.error('PANEL_PASSWORD missing.'); process.exit(1); }

/* ---------- service account ---------- */
const SA_EMAIL = process.env.GOOGLE_SA_EMAIL || 'wyszukiwarka-top3@search-400909.iam.gserviceaccount.com';
function serviceAccount(raw) {
  const s = String(raw || '').trim();
  if (s.startsWith('{')) return JSON.parse(s);
  let pem = s.replace(/\\n/g, '\n');
  if (!/BEGIN [A-Z ]*PRIVATE KEY/.test(pem)) {
    const body = pem.replace(/\s+/g, '');
    pem = '-----BEGIN PRIVATE KEY-----\n' + body.match(/.{1,64}/g).join('\n') + '\n-----END PRIVATE KEY-----\n';
  }
  return { client_email: SA_EMAIL, private_key: pem };
}
async function token(sa) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = createSign('RSA-SHA256').update(body).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: body + '.' + sig }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google token: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

/* ---------- one change sent by the panel: base64(iv12 + AES-GCM of JSON text) ---------- */
async function odszyfrujWpis(key, b64) {
  const raw = Buffer.from(String(b64).trim(), 'base64');
  if (raw.length < 30) throw new Error('short');
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, key, raw.subarray(12));
  return JSON.parse(Buffer.from(plain).toString('utf8'));
}
const RYNKI = new Set((CFG.markets || []).map(m => m.code));
const POZYCJE = new Set(CHL.items.map(i => i.id));
function poprawny(e) {
  return e && RYNKI.has(e.m) && POZYCJE.has(e.id) && (e.s === 'done' || e.s === 'na' || e.s === null) &&
    typeof e.by === 'string' && e.by.trim() && e.by.length <= 60 && !isNaN(Date.parse(e.at)) && Date.parse(e.at) < Date.now() + 36e5;
}

const salt = JSON.parse(readFileSync('data/salt.json', 'utf8'));
/* PANEL_KEY (raw key, base64) is only for local tests on the test copy */
const key = process.env.PANEL_KEY ? await subtle.importKey('raw', Buffer.from(process.env.PANEL_KEY, 'base64'), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  : await deriveKey(process.env.PANEL_PASSWORD, salt.salt, salt.iterations);
let stan = { v: 1, upTo: 0, updated: null, items: {}, log: [] };
if (existsSync(FILE)) stan = await decryptJson(key, readFileSync(FILE, 'utf8'));

const tok = await token(serviceAccount(process.env.GOOGLE_SA_KEY || readFileSync(process.env.GOOGLE_SA_KEY_FILE, 'utf8')));
const od = stan.upTo + 2;   // row 1 is the header
const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/B${od}:B?majorDimension=COLUMNS`, { headers: { Authorization: 'Bearer ' + tok } });
if (!r.ok) throw new Error('Sheets: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
const wiersze = ((await r.json()).values || [[]])[0] || [];

let dobre = 0, zle = 0;
for (const d of wiersze) {
  let e = null;
  try { e = await odszyfrujWpis(key, d); } catch (x) { e = null; }
  if (!poprawny(e)) { zle++; continue; }
  dobre++;
  const sk = stan.items[e.m] = stan.items[e.m] || {};
  const teraz = sk[e.id];
  if (!teraz || Date.parse(e.at) >= Date.parse(teraz.at)) {
    if (e.s) sk[e.id] = { s: e.s, by: e.by.trim(), at: e.at };
    else delete sk[e.id];
  }
  stan.log.push({ m: e.m, id: e.id, s: e.s, by: e.by.trim(), at: e.at });
}
/* Items checked automatically from the public website (config/checklist-verified.json), with evidence.
   Each check is applied once; a later manual change by a person wins. */
let auto = 0;
stan.applied = stan.applied || {};
const ZW = existsSync('config/checklist-verified.json') ? JSON.parse(readFileSync('config/checklist-verified.json', 'utf8')) : { checks: [] };
for (const e of ZW.checks || []) {
  const k = e.m + '|' + e.id + '|' + e.at;
  if (stan.applied[k] || !poprawny(e) || e.s !== 'done') continue;
  stan.applied[k] = 1; auto++;
  const sk = stan.items[e.m] = stan.items[e.m] || {}, teraz = sk[e.id];
  if (!teraz || Date.parse(e.at) >= Date.parse(teraz.at)) sk[e.id] = { s: 'done', by: e.by, at: e.at, ev: String(e.evidence || '').slice(0, 600) };
  stan.log.push({ m: e.m, id: e.id, s: 'done', by: e.by, at: e.at });
}
if (!wiersze.length && !auto) { console.log('No new changes.'); process.exit(0); }
stan.log = stan.log.sort((a, b) => a.at < b.at ? -1 : 1).slice(-300);
stan.upTo += wiersze.length;
stan.updated = new Date().toISOString();
writeFileSync(FILE, await encryptJson(key, stan) + '\n');
console.log(`Read ${wiersze.length} rows: ${dobre} changes applied, ${zle} skipped (not made with the panel password). Automatic checks applied: ${auto}.`);
