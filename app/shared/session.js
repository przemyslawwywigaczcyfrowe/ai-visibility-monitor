/* ---------- who is signed in, and the people with access ----------
   People, invitations and visits live in data/access.enc (written by the "Inbox sync" workflow). */
var JA = null, ACC = { people: {} }, ACC_CZAS = 0;
async function wczytajDostep() {
  try { ACC = await odszyfruj('data/access.enc'); } catch (e) { ACC = { people: {} }; }
  ACC_CZAS = Date.now();
}
function osoba(email) { return (ACC.people || {})[String(email || '').toLowerCase()] || null; }
function mojeImie() { var p = osoba(JA); return p && p.name ? p.name : JA || 'Someone'; }

/* Every message from the panel to the inbox (checklist ticks, invitations, usage) goes the same way:
   encrypted with the data key, sent as an anonymous answer to a Google Form. */
async function wyslijWiadomosc(e) {
  var c = CFG && CFG.checklist; if (!c) throw new Error('NOT_SET_UP');
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, KLUCZ, new TextEncoder().encode(JSON.stringify(e))));
  var all = new Uint8Array(12 + ct.length); all.set(iv); all.set(ct, 12);
  var q = new URLSearchParams(); q.append(c.entry, b64z(all));
  if (!(navigator.sendBeacon && navigator.sendBeacon(c.formResponse, q))) await fetch(c.formResponse, { method: 'POST', mode: 'no-cors', body: q });
}
