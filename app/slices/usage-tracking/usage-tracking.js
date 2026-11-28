/* ---------- usage, by person, for "Analityka paneli" (same events and fields as the cyfrowe.pl panels) ---------- */
var UZ = { sesja: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), ruch: Date.now(), akt: 0, kl: 0, el: {}, widok: '' };
function widokNazwa() {
  var def = PLASTRY[S.view], zRynkiem = def.naSklep && !(def.grupa && def.grupa());
  return (def.nazwa || S.view) + (zRynkiem ? ' · ' + rynek(S.market).store : '');
}
function zdarzenieUzycia(typ, widok) {
  if (!JA || !KLUCZ) return;
  var w = innerWidth || 0, el = Object.keys(UZ.el).map(function (k) { return k + '×' + UZ.el[k]; }).join('|');
  if (typ === 'aktywnosc' && !UZ.akt && !UZ.kl) return;
  var e = { t: 'ev', email: JA, typ: typ, sesja: UZ.sesja, widok: widok || UZ.widok || widokNazwa(), aktywne: UZ.akt, klik: UZ.kl, elementy: el,
    urzadzenie: w < 768 ? 'telefon' : w < 1280 ? 'laptop' : 'komputer', szerokosc: w, at: new Date().toISOString() };
  if (typ === 'aktywnosc') { UZ.akt = 0; UZ.kl = 0; UZ.el = {}; }
  wyslijWiadomosc(e).catch(function () {});
}
function nazwaKlikniecia(c) {
  var x = c.closest('button,a,[role=tab],select,input,label,th,tr.klik,.ruch li,.csk,.rkc');
  if (!x) return '~' + (c.closest('svg') ? 'wykres' : c.closest('table') ? 'tabela' : 'tekst lub tło');
  var t = (x.getAttribute('aria-label') || x.getAttribute('title') || x.textContent || x.value || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  var sek = ''; for (var a = x; a && a !== document.body; a = a.parentElement) { var h = a.querySelector && a.querySelector('h1,h2'); if (h && h.compareDocumentPosition(x) & 4) { sek = h.textContent.replace(/\s+/g, ' ').trim().slice(0, 40); break; } }
  return (sek ? sek + ' › ' : '') + (t || x.tagName.toLowerCase());
}
function wlaczSledzenie() {
  ['mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach(function (n) { document.addEventListener(n, function () { UZ.ruch = Date.now(); }, { passive: true, capture: true }); });
  document.addEventListener('click', function (ev) { UZ.ruch = Date.now(); if (document.body.classList.contains('zamkniety')) return; UZ.kl++; var c = ev.target; if (c && c.nodeType === 3) c = c.parentElement; if (!c || !c.closest) return; var n = ''; try { n = nazwaKlikniecia(c); } catch (e) { n = '~nieznane miejsce'; } UZ.el[n] = (UZ.el[n] || 0) + 1; }, true);
  setInterval(function () { if (document.visibilityState === 'visible' && Date.now() - UZ.ruch < 60000) UZ.akt += 5; }, 5000);
  setInterval(function () { zdarzenieUzycia('aktywnosc'); }, 60000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && (UZ.akt >= 15 || UZ.kl)) zdarzenieUzycia('aktywnosc'); });
}
/* a new view or store counts as an entry, as a page open does in the other panels */
var UZ_OST = '';
function liczWejscie() {
  var w = widokNazwa(); if (w === UZ_OST) return; UZ_OST = w;
  if (UZ.widok) zdarzenieUzycia('aktywnosc', UZ.widok);
  UZ.widok = w; zdarzenieUzycia('wejscie', w);
}
PLASTER('usage-tracking', { poZalogowaniu: wlaczSledzenie, poRysowaniu: liczWejscie });
