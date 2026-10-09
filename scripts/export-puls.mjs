// Export of SUMMARY NUMBERS to the "Puls sklepu" panel of cyfrowe.pl (Google Sheet, tab AI_WIDOCZNOSC).
// Only counts and prompt ids/texts (prompts are public in config.json anyway). Answers stay encrypted here.
// Definitions are the same as in index.html (kpi, sklepy, ruchy), so Puls shows the same numbers as this panel.
//
// Env: PANEL_PASSWORD (decrypts data/index.enc), GOOGLE_SA_KEY (service account JSON with edit access
// to the sheet), PULS_SHEET_ID (optional, default below), MARKET (optional, default PL).
// Local test without decryption: node scripts/export-puls.mjs --test <summary.json>
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { deriveKey, decryptJson } from './lib.mjs';

const SHEET = process.env.PULS_SHEET_ID || '1WcWoyMqYSgbz3KSQJnNEHQQCGn7ULArc4xvyPuwI95s';
const TAB = process.env.PULS_TAB || 'AI_WIDOCZNOSC';
const MARKET = process.env.MARKET || 'PL';

/* ---------- numbers, as in index.html ---------- */
function summarise(index) {
  const m = index.markets.find(x => x.code === MARKET);
  const prompts = index.prompts.filter(p => p.market === MARKET);
  const engines = (index.engines || []).map(e => e.label);
  const cell = {};
  index.hist.forEach(h => { cell[h[0] + '|' + h[1] + '|' + h[2]] = h; });
  const runs = [...new Set(index.hist.filter(h => String(h[1]).startsWith(MARKET)).map(h => h[0]))].sort();

  const kom = (run, id, e) => cell[run + '|' + id + '|' + e] || null;
  function poz(run, id, eng) {
    let best = null, data = false;
    eng.forEach(e => { const c = kom(run, id, e); if (!c || c[6]) return; data = true; if (c[3] != null && (best == null || c[3] < best)) best = c[3]; });
    return data ? best : undefined;
  }
  function kpi(run, eng) {
    const o = { n: 0, ment: 0, odp: [], first: 0, top3: 0, cited: 0, b1: 0, b3: 0, b10: 0, b0: 0 };
    prompts.forEach(p => {
      const v = poz(run, p.id, eng); if (v === undefined) return;
      o.n++;
      if (v != null) { o.ment++; if (v === 1) o.b1++; else if (v <= 3) o.b3++; else o.b10++; } else o.b0++;
      let cyt = false;
      eng.forEach(e => { const c = kom(run, p.id, e); if (!c || c[6]) return; if (c[3] != null) { o.odp.push(c[3]); if (c[3] === 1) o.first++; if (c[3] <= 3) o.top3++; } if (c[5]) cyt = true; });
      if (cyt) o.cited++;
    });
    const avg = o.odp.length ? o.odp.reduce((a, b) => a + b, 0) / o.odp.length : null;
    return { pytan: o.n, widoczne: o.ment, widocznosc: o.n ? Math.round(o.ment / o.n * 1000) / 10 : 0,
      srednieMiejsce: avg == null ? null : Math.round(avg * 10) / 10, pierwsze: o.first, top3: o.top3, cytowane: o.cited,
      rozklad: { pierwsze: o.b1, drugieTrzecie: o.b3, dalej: o.b10, brak: o.b0 } };
  }
  function sklepy(run, eng) {
    const s = {}; let all = 0, n = 0;
    prompts.forEach(p => {
      let was = false;
      eng.forEach(e => {
        const c = kom(run, p.id, e); if (!c || c[6]) return; was = true;
        if (!c[4]) return;
        String(c[4]).split('; ').forEach((nm, i) => {
          const o = s[nm] = s[nm] || { nazwa: nm, p: {}, odp: 0, sum: 0, pierwsze: 0 };
          o.p[p.id] = 1; o.odp++; o.sum += i + 1; if (!i) o.pierwsze++; all++;
        });
      });
      if (was) n++;
    });
    const l = Object.values(s).map(o => ({ nazwa: o.nazwa, pytan: Object.keys(o.p).length,
      widocznosc: n ? Math.round(Object.keys(o.p).length / n * 1000) / 10 : 0,
      srednieMiejsce: Math.round(o.sum / o.odp * 10) / 10, pierwsze: o.pierwsze, udzialGlosu: all ? Math.round(o.odp / all * 1000) / 10 : 0 }));
    if (!l.some(x => x.nazwa === m.store)) l.push({ nazwa: m.store, pytan: 0, widocznosc: 0, srednieMiejsce: null, pierwsze: 0, udzialGlosu: 0 });
    l.sort((a, b) => b.pytan - a.pytan || b.pierwsze - a.pierwsze || (a.srednieMiejsce || 99) - (b.srednieMiejsce || 99));
    return l.slice(0, 8).map(x => ({ ...x, nasz: x.nazwa === m.store }));
  }
  function ruchy(run, prev, eng) {
    const o = { lepiej: [], gorzej: [], weszlismy: [], wypadlismy: [] };
    if (!prev) return o;
    prompts.forEach(p => {
      const v = poz(run, p.id, eng), a = poz(prev, p.id, eng); if (v === undefined || a === undefined) return;
      const x = { id: p.id, pytanie: p.text, teraz: v, wczesniej: a };
      if (v != null && a == null) o.weszlismy.push(x); else if (v == null && a != null) o.wypadlismy.push(x);
      else if (v != null && v < a) o.lepiej.push(x); else if (v != null && v > a) o.gorzej.push(x);
    });
    return o;
  }
  return runs.map((run, i) => {
    const prev = i ? runs[i - 1] : null;
    const silniki = { wszystkie: kpi(run, engines) };
    engines.forEach(e => { silniki[e] = kpi(run, [e]); });
    return { pomiar: run, poprzedni: prev, rynek: MARKET, sklep: m.store, silniki, sklepy: sklepy(run, engines), ruchy: ruchy(run, prev, engines) };
  });
}

/* ---------- Google Sheets with a service account (no dependencies) ---------- */
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
async function api(tok, method, path, body) {
  const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + SHEET + path, { method,
    headers: { Authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error('Sheets ' + method + ' ' + path + ': HTTP ' + r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : {};
}
/* The secret may hold the whole service account JSON, or only its private key (PEM, or the bare
   base64 body without the BEGIN/END lines). The account e-mail is not secret, so it has a default. */
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
async function write(rows) {
  const sa = serviceAccount(process.env.GOOGLE_SA_KEY || readFileSync(process.env.GOOGLE_SA_KEY_FILE, 'utf8'));
  const tok = await token(sa);
  const meta = await api(tok, 'GET', '?fields=sheets.properties.title');
  if (!meta.sheets.some(s => s.properties.title === TAB)) {
    await api(tok, 'POST', ':batchUpdate', { requests: [{ addSheet: { properties: { title: TAB } } }] });
  }
  const values = [['pomiar', 'rynek', 'zapisano', 'dane (JSON)']].concat(rows.map(r => [r.pomiar, r.rynek, new Date().toISOString(), JSON.stringify(r)]));
  await api(tok, 'POST', '/values/' + encodeURIComponent(TAB) + ':clear', {});
  await api(tok, 'PUT', '/values/' + encodeURIComponent(TAB + '!A1') + '?valueInputOption=RAW', { values });
  console.log(`Puls: wrote ${rows.length} runs of ${MARKET} to ${TAB}.`);
}

/* ---------- main ---------- */
if (process.argv[2] === '--test') {
  await write(JSON.parse(readFileSync(process.argv[3], 'utf8')));
} else {
  const PASSWORD = process.env.PANEL_PASSWORD;
  if (!PASSWORD) { console.error('Missing PANEL_PASSWORD.'); process.exit(1); }
  if (!process.env.GOOGLE_SA_KEY) { console.log('No GOOGLE_SA_KEY secret, export to Puls skipped.'); process.exit(0); }
  const salt = JSON.parse(readFileSync('data/salt.json', 'utf8'));
  const key = await deriveKey(PASSWORD, salt.salt, salt.iterations);
  const index = await decryptJson(key, readFileSync('data/index.enc', 'utf8'));
  const rows = summarise(index);
  const last = rows[rows.length - 1];
  if (last) console.log(`Last run ${last.pomiar}: visibility ${last.silniki.wszystkie.widocznosc}% (${last.silniki.wszystkie.widoczne} of ${last.silniki.wszystkie.pytan}), avg position ${last.silniki.wszystkie.srednieMiejsce}, cited ${last.silniki.wszystkie.cytowane}.`);
  await write(rows);
}
