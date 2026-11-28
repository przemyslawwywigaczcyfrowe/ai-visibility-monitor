/* ---------- accounts (since 10 Oct 2026) ----------
   One random data key encrypts all data. Every person signs in with their e-mail and own password:
   data/logins.json holds, under SHA-256(e-mail), a salt and the data key wrapped (AES-GCM) with a key
   derived from that person's password (PBKDF2-SHA-256, 600,000 rounds). Nobody else can read the password.
   An invitation e-mail carries a one-time token; data/logins.json keeps the data key wrapped with
   SHA-256(token) until the person sets a password. People, invitations and usage live in data/access.enc. */
async function sha256hex(s) { var d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(d)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
async function loginy() { var r = await fetch('data/logins.json', { cache: 'no-store' }); if (!r.ok) throw new Error('NO_LOGINS'); return r.json(); }
async function kluczZHasla2(haslo, saltB64, it) {
  var baza = await crypto.subtle.importKey('raw', new TextEncoder().encode(haslo), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(saltB64), iterations: it || 600000 }, baza, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function odwin(k, wB64) { var raw = b64(wB64); return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, k, raw.slice(12))); }
async function zawin(k, rawKey) { var iv = crypto.getRandomValues(new Uint8Array(12)); var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, rawKey)); var all = new Uint8Array(12 + ct.length); all.set(iv); all.set(ct, 12); return b64z(all); }
async function ustawKlucz(raw) { KLUCZ = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['decrypt', 'encrypt']); }
function zapamietaj(raw, email, trwale) {
  try { sessionStorage.setItem('aiv-key', b64z(raw)); sessionStorage.setItem('aiv-user', email); if (trwale) { localStorage.setItem('aiv-key', b64z(raw)); localStorage.setItem('aiv-user', email); } } catch (e) {}
}

/* ---------- sign-in ---------- */
async function start(pamietaj) {
  var post = document.getElementById('postep');
  post.textContent = 'Decrypting the data…';
  await Promise.all([wczytaj(), wczytajDostep()]);
  post.textContent = '';
  document.getElementById('kto').textContent = JA ? 'signed in as ' + JA : '';
  var r = 'PL'; try { r = localStorage.getItem('aiv-market') || 'PL'; } catch (e) {}
  wybierzRynek(M.some(function (m) { return m.code === r; }) ? r : M[0].code);
  document.body.classList.remove('zamkniety');
  D_GOTOWE = true;
  zbierz('poZalogowaniu');
  /* A shared link opens exactly the view it points to; without a link the panel opens on All stores. */
  if (location.hash.length > 2 && !/^#\/accept/.test(location.hash)) { await wejdzZAdresu(); }
  else { history.replaceState(null, '', '#/' + WIDOK_GLOWNY); S.view = WIDOK_GLOWNY; rysuj(); }
}
async function zaloguj(email, haslo, pamietaj) {
  email = String(email || '').trim().toLowerCase();
  var L = await loginy(), u = (L.users || {})[await sha256hex(email)];
  if (!u) throw new Error('NO_USER');
  document.getElementById('postep').textContent = 'Checking the password…';
  var raw;
  try { raw = await odwin(await kluczZHasla2(haslo, u.s, L.iterations), u.w); } catch (e) { throw new Error('BAD_PASSWORD'); }
  await ustawKlucz(raw); JA = email; zapamietaj(raw, email, pamietaj);
  await start();
  zdarzenieUzycia('logowanie', 'Sign-in');
}
document.getElementById('brama-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var bl = document.getElementById('blad'), btn = document.getElementById('otworz-btn');
  bl.textContent = ''; btn.disabled = true;
  try { await zaloguj(document.getElementById('login').value, document.getElementById('haslo').value, document.getElementById('pamietaj').checked); }
  catch (err) {
    var t = String(err && err.message);
    bl.textContent = /NO_USER|BAD_PASSWORD/.test(t) ? 'The e-mail or the password is wrong. If you set your password in the last 15 minutes, wait a moment and try again.' :
      /NO_LOGINS/.test(t) ? 'Sign-in is not available right now. Try again in a few minutes.' : 'Could not load the data: ' + (err && err.message || err);
    document.getElementById('postep').textContent = '';
  }
  btn.disabled = false;
});

/* ---------- invitation: set your password ---------- */
var ZAPR = null;
async function ekranZaproszenia() {
  var q = new URLSearchParams(location.hash.split('?')[1] || ''), id = q.get('i'), tok = q.get('t');
  document.getElementById('brama-form').hidden = true;
  var f = document.getElementById('haslo-form'); f.hidden = false;
  var bl = document.getElementById('h-blad');
  try {
    if (!CFG) CFG = await (await fetch('config/config.json', { cache: 'no-store' })).json();
    var L = await loginy(), inv = (L.invites || {})[id];
    if (!inv || !tok || Date.parse(inv.exp) < Date.now()) throw new Error('EXPIRED');
    var k = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', zB64url(tok)), { name: 'AES-GCM' }, false, ['decrypt']);
    var raw = await odwin(k, inv.w);
    await ustawKlucz(raw); await wczytajDostep();
    var p = Object.keys(ACC.people || {}).map(function (x) { return ACC.people[x]; }).filter(function (x) { return x.inviteId === id; })[0];
    if (!p) throw new Error('EXPIRED');
    ZAPR = { id: id, raw: raw, p: p, it: L.iterations || 600000 };
    document.getElementById('h-tytul').textContent = 'Welcome' + (p.name ? ', ' + p.name.split(' ')[0] : '');
    document.getElementById('h-kto').textContent = ((osoba(p.invitedBy) || {}).name || p.invitedBy || 'A colleague') + ' invited you to AI Visibility. Set a password for your login.';
    document.getElementById('h-login').value = p.email;
    document.getElementById('h-haslo').focus();
  } catch (e) {
    KLUCZ = null;
    document.getElementById('h-tytul').textContent = 'This invitation does not work any more';
    document.getElementById('h-kto').textContent = 'It has expired or was already used. Ask anyone with access to send you a new one, or sign in if you already set your password.';
    document.getElementById('h-pola').hidden = true;
    bl.innerHTML = '<a href="./" class="btn duzy" style="margin-top:8px">Go to sign-in</a>';
  }
}
document.getElementById('h-pokaz').onclick = function () { var i = document.getElementById('h-haslo'); i.type = i.type === 'password' ? 'text' : 'password'; this.textContent = i.type === 'password' ? 'Show' : 'Hide'; };
document.getElementById('h-haslo').oninput = function () { document.getElementById('h-dl').className = 'wsk' + (this.value.length >= 12 ? ' ok' : ''); };
document.getElementById('haslo-form').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var haslo = document.getElementById('h-haslo').value, bl = document.getElementById('h-blad'), btn = document.getElementById('h-btn');
  if (haslo.length < 12) { bl.textContent = 'Use at least 12 characters.'; return; }
  if (!ZAPR) return;
  btn.disabled = true; bl.textContent = ''; document.getElementById('h-postep').textContent = 'Saving your password…';
  try {
    var salt = crypto.getRandomValues(new Uint8Array(16)), saltB = b64z(salt);
    var w = await zawin(await kluczZHasla2(haslo, saltB, ZAPR.it), ZAPR.raw);
    await wyslijWiadomosc({ t: 'accept', id: ZAPR.id, email: ZAPR.p.email, s: saltB, w: w, at: new Date().toISOString() });
    JA = ZAPR.p.email; zapamietaj(ZAPR.raw, JA, true);
    document.getElementById('haslo-form').hidden = true; document.getElementById('brama-form').hidden = false;
    await start();
    zdarzenieUzycia('logowanie', 'Password set');
  } catch (err) { bl.textContent = 'Not saved: ' + (err && err.message || err) + '. Try again.'; btn.disabled = false; document.getElementById('h-postep').textContent = ''; }
});

/* ---------- sign-out ---------- */
document.getElementById('wyloguj').onclick = function () {
  zdarzenieUzycia('aktywnosc');
  try { ['aiv-key', 'aiv-user'].forEach(function (k) { sessionStorage.removeItem(k); localStorage.removeItem(k); }); } catch (e) {}
  setTimeout(function () { location.href = './'; }, 300);
};

/* ---------- entry: an invitation link, a remembered session, or the sign-in form ---------- */
async function wejscie() {
  if (/^#\/accept/.test(location.hash)) { await ekranZaproszenia(); return; }
  var s = null, u = null; try { s = sessionStorage.getItem('aiv-key') || localStorage.getItem('aiv-key'); u = sessionStorage.getItem('aiv-user') || localStorage.getItem('aiv-user'); } catch (e) {}
  if (s && u) {
    try { await ustawKlucz(b64(s)); JA = u; await start(); return; }
    catch (e) { try { ['aiv-key', 'aiv-user'].forEach(function (k) { sessionStorage.removeItem(k); localStorage.removeItem(k); }); } catch (x) {} JA = null; KLUCZ = null; }
  }
  document.getElementById('login').focus();
}
