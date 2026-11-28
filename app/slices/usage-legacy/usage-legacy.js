/* ---------- legacy: anonymous counter and the Usage view (7-10 Oct 2026) ----------
   Replaced on 10 Oct 2026 by per-person usage (app/slices/usage-tracking). The counter sends nothing
   (licz returns at once) and no link leads to the Usage view. Kept as it was; this folder and its two
   tags in index.html can be deleted together. */
/* ---------- usage counting (Google Form + Apps Script, no outside service) ----------
   Counts which views and stores are opened, plus three events: sign-in, prompt opened, CSV export.
   Each count is one anonymous form answer: path, title, a random per-tab session id (sessionStorage,
   gone when the tab closes), language, time zone, browser name and screen class. No cookies, no names.
   The owner's own device is not counted (localStorage "aiv-owner", set when the Usage view opens). */
var LICZ = null, LICZ_KOLEJKA = [], LICZ_OST = '';
function wlaczLicznik() {
  fetch('config/config.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (c) {
    LICZ = c.analytics || null;
    var k = LICZ_KOLEJKA; LICZ_KOLEJKA = null; k.forEach(wyslij);
  }).catch(function () { LICZ_KOLEJKA = null; });
}
function sesja() {
  try { var s = sessionStorage.getItem('aiv-s'); if (!s) { s = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('aiv-s', s); } return s; } catch (e) { return ''; }
}
function przegladarka() {
  var u = navigator.userAgent;
  return /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Other';
}
function wyslij(x) {
  try {
    if (!LICZ || !LICZ.formResponse || !LICZ.entries || localStorage.getItem('aiv-owner')) return;
    var w = innerWidth, e = LICZ.entries, q = new URLSearchParams();
    var v = { path: x.path, title: x.title, event: x.event ? '1' : '0', session: sesja(), lang: navigator.language || '',
      tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || ''), browser: przegladarka(), device: w < 768 ? 'Phone' : w < 1100 ? 'Tablet' : 'Computer' };
    Object.keys(v).forEach(function (k) { if (e[k]) q.append(e[k], v[k]); });
    if (!(navigator.sendBeacon && navigator.sendBeacon(LICZ.formResponse, q))) fetch(LICZ.formResponse, { method: 'POST', mode: 'no-cors', body: q });
  } catch (err) {}
}
function licz(path, title, event) {
  /* The anonymous counter (Usage view) was replaced on 10 Oct 2026 by per-person usage in Analityka paneli. */
  return;
  var x = { path: path, title: title, event: !!event };
  if (LICZ_KOLEJKA) LICZ_KOLEJKA.push(x); else wyslij(x);
}
function liczWidok() {
  if (S.view === 'usage') return;
  var zRynkiem = S.view !== 'all' && S.view !== 'how' && !(S.view === 'checklist' && S.chkAll);
  var path = '/' + S.view + (zRynkiem ? '/' + S.market.toLowerCase() : '');
  if (path === LICZ_OST) return;
  LICZ_OST = path;
  licz(path, PLASTRY[S.view].nazwa + (zRynkiem ? ' · ' + rynek(S.market).store : ''));
}
/* ---------- Usage (owner only) ----------
   The Apps Script web app (access: cyfrowe.pl only) checks the Google account of the caller and
   returns the numbers only to the owner. The panel loads them as JSONP, so the request carries the
   owner's Google sign-in. Nobody else gets data, whatever they know about the panel. */
var USAGE = null, USAGE_BLAD = '';
function jestWlasciciel() { try { return !!localStorage.getItem('aiv-owner'); } catch (e) { return false; } }
function wczytajUsage() {
  return new Promise(function (ok, nie) {
    var api = CFG && CFG.analytics && CFG.analytics.usageApi;
    if (!api) return nie(new Error('NOT_SET_UP'));
    var cb = 'aivUsage' + Date.now(), s = document.createElement('script'), t = setTimeout(function () { sprzataj(); nie(new Error('NO_ANSWER')); }, 20000);
    function sprzataj() { clearTimeout(t); delete window[cb]; s.remove(); }
    window[cb] = function (d) { sprzataj(); if (d && d.error) nie(new Error(d.error)); else ok(d); };
    s.onerror = function () { sprzataj(); nie(new Error('NO_ANSWER')); };
    s.src = api + (api.indexOf('?') < 0 ? '?' : '&') + 'callback=' + cb;
    document.head.appendChild(s);
  });
}
function widokUsage() {
  var api = CFG && CFG.analytics && CFG.analytics.usageApi;
  if (!USAGE) {
    if (!USAGE_BLAD) setTimeout(function () {
      wczytajUsage().then(function (d) { USAGE = d; try { localStorage.setItem('aiv-owner', '1'); } catch (e) {} rysuj(); })
        .catch(function (e) { USAGE_BLAD = e.message; rysuj(); });
    }, 0);
    var tekst = !USAGE_BLAD ? 'Loading the usage numbers…' :
      USAGE_BLAD === 'NOT_SET_UP' ? 'Usage counting is not set up yet.' :
      USAGE_BLAD === 'not-owner' ? 'This view is only for the panel owner. Sign in to Google with the owner\'s cyfrowe.pl account in this browser and reload.' :
      'The numbers did not load. Open the usage service once in a new tab (it may ask you to sign in or allow access), then come back and reload.';
    return '<div class="tytul"><h1>Usage</h1><span class="op">Only for the panel owner</span></div><section class="card" style="max-width:640px"><p style="font-size:15px;color:var(--ink2)">' + esc(tekst) + '</p>' +
      (USAGE_BLAD && api ? '<p style="margin-top:14px;display:flex;gap:10px"><a class="btn" href="' + esc(api) + '" target="_blank" rel="noopener">Open the usage service</a><button class="btn primary" id="u-ponow">Try again</button></p>' : '') + '</section>';
  }
  var U = USAGE, dni = U.total.days, dzis = new Date().toISOString().slice(0, 10);
  function suma(od) { return dni.filter(function (x) { return x[0] >= od; }).reduce(function (a, x) { return a + (x[1] || 0); }, 0); }
  function dzienTemu(n) { return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }
  var widoki = U.hits.filter(function (h) { return !h.event; }), zd = U.hits.filter(function (h) { return h.event; });
  function wOkresie(h, od) { return (h.days || []).filter(function (x) { return x[0] >= od; }).reduce(function (a, x) { return a + (x[1] || 0); }, 0); }
  function zdarzenia(pref, od) { return zd.filter(function (h) { return h.path.indexOf(pref) === 0; }).reduce(function (a, h) { return a + wOkresie(h, od); }, 0); }
  var d7 = dzienTemu(6), d30 = dzienTemu(29);
  var k = [['Visits, last 7 days', suma(d7)], ['Visits, last 30 days', suma(d30)], ['Sign-ins, last 30 days', zdarzenia('signed-in', d30)],
    ['Prompts opened, last 30 days', zdarzenia('open-prompt', d30)], ['CSV exports, last 30 days', zdarzenia('export-csv', d30)], ['Sign-in page views, last 30 days', wOkresie(widoki.filter(function (h) { return h.path === '/sign-in'; })[0] || {}, d30)]];
  var h = '<div class="tytul"><h1>Usage</h1><span class="op">anonymous counts · no cookies, no names · ' + esc(new Date(U.updated).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })) + ' · your own visits on this device are not counted</span></div>';
  h += '<div class="kpi k6">' + k.map(function (x) { return '<div class="t"><div class="k">' + x[0] + '</div><div class="v"><b class="num">' + fmt(x[1]) + '</b></div></div>'; }).join('') + '</div>';
  var L = dni.map(function (x) { return x[0]; }).slice(-60);
  var mapa = {}; dni.forEach(function (x) { mapa[x[0]] = x[1]; });
  h += '<section class="card" style="margin-bottom:16px"><div class="ch"><h2>Visits per day <small>last ' + L.length + ' days</small></h2></div>' + wykres('w-usage', L, [{ name: 'Visits', color: '#0B57D0', w: 2.5, values: L.map(function (d) { return mapa[d] || 0; }) }]) + '</section>';
  /* views grouped as "Summary · Cyfrowe.pl" */
  var tab = widoki.filter(function (h) { return h.path !== '/sign-in'; }).map(function (h) { return { t: h.title || h.path, p: h.path, w7: wOkresie(h, d7), w30: wOkresie(h, d30), all: h.count || 0 }; })
    .sort(function (a, b) { return b.w30 - a.w30 || b.all - a.all; });
  var sklep = {}; M.forEach(function (m) { sklep[m.code] = 0; });
  widoki.forEach(function (h) { var mm = h.path.match(/^\/[a-z]+\/([a-z]{2})$/); if (mm) sklep[mm[1].toUpperCase()] = (sklep[mm[1].toUpperCase()] || 0) + wOkresie(h, d30); });
  h += '<div class="g2"><section class="card" style="padding:4px 8px 8px"><table class="t"><thead><tr><th>View</th><th class="r">Last 7 days</th><th class="r">Last 30 days</th><th class="r">Since ' + esc(U.start) + '</th></tr></thead><tbody>' +
    (tab.length ? tab.map(function (r) { return '<tr><td>' + esc(r.t) + '</td><td class="r num">' + r.w7 + '</td><td class="r num"><b>' + r.w30 + '</b></td><td class="r num">' + r.all + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="pusto">No visits counted yet.</td></tr>') +
    '</tbody></table></section><div style="display:flex;flex-direction:column;gap:16px">' +
    '<section class="card"><div class="ch"><h2>Stores opened <small>visits in the last 30 days</small></h2></div><table class="t"><tbody>' +
    M.map(function (m) { return '<tr><td>' + logo(m.code, 18) + '</td><td class="r num"><b>' + (sklep[m.code] || 0) + '</b></td></tr>'; }).join('') + '</tbody></table></section>' +
    lista('Time zones', U.locations) + lista('Browsers', U.browsers) + lista('Devices', U.sizes) + '</div></div>';
  function lista(t, l) { return '<section class="card"><div class="ch"><h2>' + t + ' <small>visits since ' + esc(U.start) + '</small></h2></div>' + ((l || []).length ? '<table class="t"><tbody>' + l.slice(0, 8).map(function (x) { return '<tr><td>' + esc(x[0] || 'unknown') + '</td><td class="r num">' + x[1] + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="pusto">No data yet.</div>') + '</section>'; }
  return h;
}
wlaczLicznik();
PLASTER('usage', {
  zLinku: false,
  przedRysowaniem: function () {
    document.querySelectorAll('.tylko-wl').forEach(function (b) { b.hidden = !jestWlasciciel(); });
    liczWidok();
  },
  rysuj: widokUsage,
  podepnij: function () { var up = document.getElementById('u-ponow'); if (up) up.onclick = function () { USAGE_BLAD = ''; rysuj(); }; }
});
