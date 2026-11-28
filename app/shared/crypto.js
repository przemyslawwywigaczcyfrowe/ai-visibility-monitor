/* ---------- decryption ----------
   data/*.enc is encrypted with AES-256-GCM. The data key is unwrapped at sign-in (app/slices/sign-in). */
var KLUCZ = null;
function b64(s) { var b = atob(s.trim()), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function b64z(u) { var s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
/* Not used since the personal accounts of 10 Oct 2026 (one shared password, data/salt.json). */
async function kluczZHasla(h) {
  var sol = await (await fetch('data/salt.json', { cache: 'no-store' })).json();
  var baza = await crypto.subtle.importKey('raw', new TextEncoder().encode(h), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(sol.salt), iterations: sol.iterations }, baza, { name: 'AES-GCM', length: 256 }, true, ['decrypt', 'encrypt']);
}
async function odszyfruj(path, klucz) {
  var res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(res.status === 404 ? 'NO_DATA' : 'HTTP ' + res.status);
  var raw = b64(await res.text());
  var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, klucz || KLUCZ, raw.slice(12));
  return JSON.parse(await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}
function b64url(u) { return b64z(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function zB64url(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return b64(s); }
