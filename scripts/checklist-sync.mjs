// Inbox sync, every ~10 minutes. The panel is a static page, so everything it needs to save goes
// through one Google Form (field "d"): each answer is a message encrypted with the data key.
// A message that does not decrypt was not sent by someone signed in, and is skipped.
//
// Message types (field t):
//   (none) / chk  checklist tick: { m, id, s: 'done'|'na'|null, by, at }
//   invite        { email, name, by, id, tok, at }  -> invitation e-mail with a one-time link
//   accept        { id, email, s (salt), w (wrapped key), at } -> the person's own login
//   remove        { email, by, at }
//   ev            usage event: { email, typ, sesja, widok, aktywne, klik, elementy, urzadzenie, szerokosc, at }
//
// Writes: data/checklist.enc (checklist + row cursor), data/access.enc (people), data/logins.json
// (public: per person the data key wrapped with a key from their password, looked up by a hash of
// the e-mail; open invitations wrapped with a one-time token), the outbox sheet (e-mails that the
// "AI Visibility mailer" Apps Script sends) and the "Analityka paneli" sheet.
//
// Env: DATA_KEY, GOOGLE_SA_KEY (or GOOGLE_SA_KEY_FILE). DRY=1: no writes to Google sheets.
// Local bootstrap: node scripts/checklist-sync.mjs --invite <email> "<name>"
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createSign, createHash, randomBytes, webcrypto } from 'node:crypto';
import { dataKey, encryptJson, decryptJson } from './lib.mjs';

const subtle = webcrypto.subtle;
const CFG = JSON.parse(readFileSync('config/config.json', 'utf8'));
const CHL = JSON.parse(readFileSync('config/checklist.json', 'utf8'));
const AC = CFG.access || {};
const SHEET = CFG.checklist && CFG.checklist.sheetId;
const SITE = AC.site || 'https://przemyslawwywigaczcyfrowe.github.io/ai-visibility-monitor/';
const OWNER = (AC.owner || 'przemyslaw.wywigacz@cyfrowe.pl').toLowerCase();
const DNI_ZAPROSZENIA = 7;
const DRY = !!process.env.DRY;

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
  const body = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = createSign('RSA-SHA256').update(body).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: body + '.' + sig }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google token: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}
let TOK = null;
async function sheets(method, id, path, body) {
  TOK = TOK || await token(serviceAccount(process.env.GOOGLE_SA_KEY || readFileSync(process.env.GOOGLE_SA_KEY_FILE, 'utf8')));
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}${path}`, { method,
    headers: { Authorization: 'Bearer ' + TOK, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`Sheets ${method} ${path.slice(0, 60)}: HTTP ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
}
async function dopisz(id, wiersze) {
  if (!wiersze.length || !id) return;
  if (DRY) { console.log(`DRY: would append ${wiersze.length} rows to ${id}`); return; }
  await sheets('POST', id, `/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { values: wiersze });
}

/* ---------- crypto ---------- */
async function odszyfrujWpis(key, b64) {
  const raw = Buffer.from(String(b64).trim(), 'base64');
  if (raw.length < 30) throw new Error('short');
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, key, raw.subarray(12));
  return JSON.parse(Buffer.from(plain).toString('utf8'));
}
/* the data key wrapped for an invitation: AES-GCM with SHA-256(token) as the key */
async function owinDlaZaproszenia(rawKey, tok) {
  const k = await subtle.importKey('raw', createHash('sha256').update(Buffer.from(tok, 'base64url')).digest(), { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = randomBytes(12);
  const ct = Buffer.from(await subtle.encrypt({ name: 'AES-GCM', iv }, k, rawKey));
  return Buffer.concat([iv, ct]).toString('base64');
}
const hashEmail = e => createHash('sha256').update(String(e).trim().toLowerCase()).digest('hex');
const okEmail = e => typeof e === 'string' && /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(e.trim());
const okCzas = t => !isNaN(Date.parse(t)) && Date.parse(t) < Date.now() + 36e5;
const tekst = (v, max) => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const liczba = (v, max) => { const n = Math.round(Number(v) || 0); return n < 0 ? 0 : n > max ? max : n; };

/* ---------- state ---------- */
const key = await dataKey();
const rawKey = Buffer.from(await subtle.exportKey('raw', key));
const FILE_CHK = 'data/checklist.enc', FILE_ACC = 'data/access.enc', FILE_LOG = 'data/logins.json';
let chk = { v: 1, upTo: 0, updated: null, items: {}, log: [] };
if (existsSync(FILE_CHK)) chk = await decryptJson(key, readFileSync(FILE_CHK, 'utf8'));
let acc = { v: 1, people: {} };
if (existsSync(FILE_ACC)) acc = await decryptJson(key, readFileSync(FILE_ACC, 'utf8'));
let logins = { v: 1, iterations: 600000, users: {}, invites: {} };
if (existsSync(FILE_LOG)) logins = JSON.parse(readFileSync(FILE_LOG, 'utf8'));
const outbox = [], analityka = [];
let zmianyDostepu = 0;

const czasPL = iso => new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Warsaw' });
const dataEN = ms => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Warsaw' });
const imie = email => { const p = acc.people[String(email || '').toLowerCase()]; return p && p.name ? p.name : String(email || ''); };
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function mailZaproszenia(o) {
  const link = SITE + '#/accept?i=' + o.id + '&t=' + o.tok;
  const pierwsze = (o.name || '').split(' ')[0];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:560px">
<img src="${SITE}assets/logo-email.png" alt="AI Visibility" width="220" style="display:block;margin:0 0 20px">
<h2 style="font-size:21px;margin:0 0 12px">${pierwsze ? escH(pierwsze) + ', you' : 'You'} have access to AI Visibility</h2>
<p style="margin:0 0 12px">${escH(o.byName)} gave you access to AI Visibility, the panel where European Imaging Group tracks how ChatGPT and Google AI Mode recommend our stores.</p>
<p style="margin:0 0 6px">Your login is this e-mail address. Click the button to set your password:</p>
<p style="margin:16px 0"><a href="${link}" style="display:inline-block;background:#0B57D0;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:24px;font-weight:bold">Set my password</a></p>
<p style="margin:0 0 18px;font-size:13.5px;color:#555">The link works once and expires on ${dataEN(o.exp)}. If it has expired, ask anyone with access to send a new invitation.</p>
<p style="margin:0;font-size:12.5px;color:#777;border-top:1px solid #eee;padding-top:12px">AI Visibility · European Imaging Group · built by Przemysław Wywigacz, Cyfrowe.pl. You get this e-mail because someone with access invited you.</p></div>`;
  return [czasPL(new Date().toISOString()), o.email, 'Your access to AI Visibility', html, ''];
}

async function zapros(e) {
  const email = e.email.trim().toLowerCase();
  const tok = e.tok || randomBytes(32).toString('base64url');
  const id = e.id || randomBytes(9).toString('base64url');
  const exp = Date.parse(e.at) + DNI_ZAPROSZENIA * 864e5;
  /* one open invitation per person: a new one replaces the old */
  const p = acc.people[email] = acc.people[email] || { email, since: null, status: 'invited', visitDays: {} };
  if (p.inviteId) delete logins.invites[p.inviteId];
  p.name = tekst(e.name, 80) || p.name || '';
  p.invitedBy = tekst(e.by, 120); p.invitedAt = e.at; p.inviteId = id; p.exp = new Date(exp).toISOString();
  if (p.status !== 'active') p.status = 'invited';
  logins.invites[id] = { w: await owinDlaZaproszenia(rawKey, tok), exp: p.exp };
  outbox.push(mailZaproszenia({ email, name: p.name, byName: imie(e.by) || 'Przemysław Wywigacz', id, tok, exp }));
  if (DRY) console.log(`DRY invitation link for ${email}: ${SITE}#/accept?i=${id}&t=${tok}`);
  zmianyDostepu++;
}
function przyjmij(e) {
  const email = String(e.email || '').trim().toLowerCase(), p = acc.people[email], inv = logins.invites[e.id];
  if (!p || p.inviteId !== e.id || !inv || Date.parse(inv.exp) < Date.parse(e.at) || !/^[A-Za-z0-9+/=]{20,}$/.test(e.s) || !/^[A-Za-z0-9+/=]{60,}$/.test(e.w)) return false;
  logins.users[hashEmail(email)] = { s: e.s, w: e.w };
  delete logins.invites[e.id];
  p.status = 'active'; p.since = p.since || e.at; p.inviteId = null; p.exp = null;
  zmianyDostepu++;
  return true;
}
function usun(e) {
  const email = String(e.email || '').trim().toLowerCase(), p = acc.people[email];
  if (!p || email === OWNER) return false;
  delete logins.users[hashEmail(email)];
  if (p.inviteId) delete logins.invites[p.inviteId];
  p.status = 'removed'; p.removedBy = tekst(e.by, 120); p.removedAt = e.at; p.inviteId = null; p.exp = null;
  zmianyDostepu++;
  return true;
}
function zdarzenie(e) {
  const email = String(e.email || '').trim().toLowerCase(), p = acc.people[email];
  if (!p || p.status !== 'active') return false;
  const typy = { wejscie: 1, aktywnosc: 1, logowanie: 1, odpowiedz: 1, checklista: 1, csv: 1, zaproszenie: 1 };
  if (!typy[e.typ]) return false;
  analityka.push([czasPL(e.at), 'AI Visibility', e.typ, email, tekst(e.sesja, 40), tekst(e.widok, 60), liczba(e.aktywne, 900), liczba(e.klik, 1000),
    tekst(e.elementy, 4000), tekst(e.urzadzenie, 20), liczba(e.szerokosc, 10000)]);
  if (e.typ === 'wejscie' || e.typ === 'logowanie') {
    const d = czasPL(e.at).slice(0, 10);
    p.visitDays = p.visitDays || {}; p.visitDays[d] = (p.visitDays[d] || 0) + 1;
    const granica = czasPL(new Date(Date.now() - 90 * 864e5).toISOString()).slice(0, 10);
    Object.keys(p.visitDays).forEach(k => { if (k < granica) delete p.visitDays[k]; });
  }
  if (!p.lastSeen || e.at > p.lastSeen) p.lastSeen = e.at;
  return true;
}

/* checklist ticks */
const RYNKI = new Set((CFG.markets || []).map(m => m.code));
const POZYCJE = new Set(CHL.items.map(i => i.id));
function poprawnyChk(e) {
  return e && RYNKI.has(e.m) && POZYCJE.has(e.id) && (e.s === 'done' || e.s === 'na' || e.s === null) &&
    typeof e.by === 'string' && e.by.trim() && e.by.length <= 120 && okCzas(e.at);
}
function odhacz(e, ev) {
  const sk = chk.items[e.m] = chk.items[e.m] || {}, teraz = sk[e.id];
  if (!teraz || Date.parse(e.at) >= Date.parse(teraz.at)) {
    if (e.s) sk[e.id] = Object.assign({ s: e.s, by: e.by.trim(), at: e.at }, ev ? { ev } : {});
    else delete sk[e.id];
  }
  chk.log.push({ m: e.m, id: e.id, s: e.s, by: e.by.trim(), at: e.at });
}

/* ---------- local bootstrap: --invite <email> "<name>" ---------- */
const arg = process.argv.indexOf('--invite');
if (arg > 0) {
  const email = process.argv[arg + 1], name = process.argv[arg + 2] || '';
  if (!okEmail(email)) { console.error('Bad e-mail.'); process.exit(1); }
  await zapros({ email, name, by: OWNER, at: new Date().toISOString() });
}

/* ---------- new form answers ---------- */
let wiersze = [];
if (SHEET && arg < 0) {
  const d = await sheets('GET', SHEET, `/values/B${chk.upTo + 2}:B?majorDimension=COLUMNS`);
  wiersze = (d.values || [[]])[0] || [];
}
const licz = { chk: 0, invite: 0, accept: 0, remove: 0, ev: 0, zle: 0 };
for (const d of wiersze) {
  let e = null;
  try { e = await odszyfrujWpis(key, d); } catch (x) { e = null; }
  if (!e || typeof e !== 'object') { licz.zle++; continue; }
  const t = e.t || 'chk';
  if (t === 'chk' && poprawnyChk(e)) { odhacz(e); licz.chk++; }
  else if (t === 'invite' && okEmail(e.email) && okCzas(e.at) && /^[A-Za-z0-9_-]{40,}$/.test(e.tok || '') && /^[A-Za-z0-9_-]{8,}$/.test(e.id || '')) { await zapros(e); licz.invite++; }
  else if (t === 'accept' && okCzas(e.at) && przyjmij(e)) licz.accept++;
  else if (t === 'remove' && okCzas(e.at) && usun(e)) licz.remove++;
  else if (t === 'ev' && okCzas(e.at) && zdarzenie(e)) licz.ev++;
  else licz.zle++;
}
chk.upTo += wiersze.length;

/* items checked automatically from the public website (config/checklist-verified.json), once each */
let auto = 0;
chk.applied = chk.applied || {};
const ZW = existsSync('config/checklist-verified.json') ? JSON.parse(readFileSync('config/checklist-verified.json', 'utf8')) : { checks: [] };
for (const e of ZW.checks || []) {
  const k = e.m + '|' + e.id + '|' + e.at;
  if (chk.applied[k] || !poprawnyChk(e) || e.s !== 'done') continue;
  chk.applied[k] = 1; auto++;
  odhacz(e, String(e.evidence || '').slice(0, 600));
}

/* expired invitations leave the public file */
for (const [id, inv] of Object.entries(logins.invites)) if (Date.parse(inv.exp) < Date.now()) { delete logins.invites[id]; zmianyDostepu++; }

if (!wiersze.length && !auto && !zmianyDostepu) { console.log('No new changes.'); process.exit(0); }
await dopisz(AC.outboxSheet, outbox);
await dopisz(AC.analyticsSheet, analityka);
chk.log = chk.log.sort((a, b) => a.at < b.at ? -1 : 1).slice(-300);
chk.updated = acc.updated = new Date().toISOString();
writeFileSync(FILE_CHK, await encryptJson(key, chk) + '\n');
writeFileSync(FILE_ACC, await encryptJson(key, acc) + '\n');
writeFileSync(FILE_LOG, JSON.stringify(logins, null, 1) + '\n');
console.log(`Read ${wiersze.length} rows: checklist ${licz.chk}, invitations ${licz.invite}, accepted ${licz.accept}, removed ${licz.remove}, usage events ${licz.ev}, skipped ${licz.zle}. Automatic checks: ${auto}. E-mails queued: ${outbox.length}.`);
