/* ---------- Checklist (AI readiness, by Przemysław Wywigacz) ----------
   122 items from config/checklist.json. Each store ticks its own items: done or not applicable.
   Progress = done / (all - not applicable). Who ticked what is shared through the encrypted form, see below. */
var OTWARTE = {}, OST_OTW = null, SKOK = null;
/* The longer explanation of an item, opened by a click on its title. */
function szczegolyPozycji(i, x) {
  return '<div class="cex">' + (x && x.ev ? '<div class="cdow"><h4>Checked on the website on ' + esc(kiedyKrotko(x.at)) + '</h4><p>' + esc(x.ev) + '</p></div>' : '') + [['what', 'What is it about?'], ['why', 'Why does it matter?'], ['how', 'How to do it and check it?']].map(function (k) {
    return i.x[k[0]] ? '<div><h4>' + k[1] + '</h4><p>' + esc(i.x[k[0]]) + '</p></div>' : '';
  }).join('') + '</div>';
}
var CHL = null, CHK = {}, CF = { st: 'all', pr: '', ef: '', q: '' };
/* Shared state: data/checklist.enc, written by the "Checklist sync" workflow every ~10 minutes from the
   encrypted form answers. Own changes not synced yet are kept in this browser (aiv-chk-pending)
   and shown on top, so a tick is visible at once. */
var CHK_SYNC = { items: {}, log: [], updated: null }, CHK_CZAS = 0;
function czekajace() { try { return JSON.parse(localStorage.getItem('aiv-chk-pending') || '[]'); } catch (e) { return []; } }
function polaczStan() {
  var syn = CHK_SYNC.items || {}, out = {};
  Object.keys(syn).forEach(function (m) { out[m] = {}; Object.keys(syn[m]).forEach(function (id) { out[m][id] = syn[m][id]; }); });
  /* a pending change is dropped once the synced state has the same or a newer change of that item, or after 2 days */
  var zost = czekajace().filter(function (e) {
    var x = (syn[e.m] || {})[e.id], wSync = (CHK_SYNC.log || []).some(function (l) { return l.m === e.m && l.id === e.id && l.at >= e.at; });
    return !wSync && !(x && x.at >= e.at) && Date.now() - Date.parse(e.at) < 2 * 864e5;
  });
  try { localStorage.setItem('aiv-chk-pending', JSON.stringify(zost)); } catch (e) {}
  zost.sort(function (a, b) { return a.at < b.at ? -1 : 1; }).forEach(function (e) {
    out[e.m] = out[e.m] || {};
    if (e.s) out[e.m][e.id] = { s: e.s, by: e.by, at: e.at, pending: true }; else delete out[e.m][e.id];
  });
  CHK = out;
}
async function wczytajStanChecklisty() {
  try { CHK_SYNC = await odszyfruj('data/checklist.enc'); } catch (e) { if (!/NO_DATA/.test(e.message)) console.warn('checklist', e); }
  CHK_CZAS = Date.now(); polaczStan();
}
function adresChecklisty() {
  var q = new URLSearchParams();
  if (CF.st !== 'all') q.set('status', CF.st); if (CF.pr) q.set('priority', CF.pr); if (CF.ef) q.set('effort', CF.ef); if (CF.q) q.set('q', CF.q); if (OST_OTW && OTWARTE[OST_OTW]) q.set('item', OST_OTW);
  var t = q.toString();
  return '#/checklist/' + (S.chkAll ? 'all' : S.market.toLowerCase()) + (t ? '?' + t : '');
}
function czytajFiltryChecklisty(q) {
  CF.st = ['open', 'done', 'na'].indexOf(q.get('status')) >= 0 ? q.get('status') : 'all';
  CF.pr = ['P1', 'P2', 'P3'].indexOf(q.get('priority')) >= 0 ? q.get('priority') : '';
  CF.ef = ['S', 'M', 'L'].indexOf(q.get('effort')) >= 0 ? q.get('effort') : '';
  CF.q = q.get('q') || '';
  /* a shared link with ?item=3.2 opens that item's details and scrolls to it */
  var it = q.get('item');
  if (it && CHL && CHL.items.some(function (i) { return i.id === it; })) { OTWARTE[it] = 1; OST_OTW = it; SKOK = it; }
}
function stan(code, id) { return (CHK[code] || {})[id] || null; }
function postep(code, lista) {
  var o = { n: 0, done: 0, na: 0 };
  (lista || CHL.items).forEach(function (i) { var x = stan(code, i.id); o.n++; if (x && x.s === 'done') o.done++; else if (x && x.s === 'na') o.na++; });
  o.base = o.n - o.na; o.pct = o.base ? o.done / o.base * 100 : 0; o.open = o.base - o.done;
  return o;
}
function pasekPostepu(p, h) {
  return '<div class="cpas" style="height:' + (h || 10) + 'px" title="' + p.done + ' done, ' + p.open + ' open' + (p.na ? ', ' + p.na + ' not applicable' : '') + '"><i style="width:' + (p.n ? p.done / p.n * 100 : 0) + '%"></i><i class="na" style="width:' + (p.n ? p.na / p.n * 100 : 0) + '%"></i></div>';
}
var AUDYT = { yes: 'done', partly: 'partly done', no: 'not done', '?': 'not checked', na: 'not applicable' };
function widokChecklist() {
  if (!CHL) return '<div class="pusto">The checklist did not load.</div>';
  /* fresh shared state when the view is opened again after 2 minutes */
  if (Date.now() - CHK_CZAS > 12e4) { CHK_CZAS = Date.now(); wczytajStanChecklisty().then(function () { if (S.view === 'checklist') { var y = window.scrollY; rysuj(); window.scrollTo(0, y); } }); }
  return S.chkAll ? checklistaGrupy() : checklistaSklepu();
}
function checklistaSklepu() {
  var m = rynek(S.market), code = m.code, all = postep(code);
  var p = {}; ['P1', 'P2', 'P3'].forEach(function (k) { p[k] = postep(code, CHL.items.filter(function (i) { return i.p === k; })); });
  var szybkie = CHL.items.filter(function (i) { return i.p === 'P1' && i.e === 'S' && !stan(code, i.id); }).length;
  var ost = null; Object.keys(CHK[code] || {}).forEach(function (id) { var x = CHK[code][id]; if (!ost || x.at > ost.at) ost = x; });
  var h = hero({
    ocena: all.done ? null : ['', 'Not started'],
    okres: 'AI readiness checklist ' + CHL.version + ' · ' + CHL.items.length + ' items · by ' + CHL.author,
    werdykt: esc(m.store) + ' has done <span class="kw">' + all.done + ' of ' + all.base + ' items</span>',
    zd: 'Critical items (P1): <b>' + p.P1.done + ' of ' + p.P1.base + '</b> done. Critical items that take only a few days and are still open: <b>' + szybkie + '</b>.' +
      (ost ? ' Last change ' + esc(kiedyKrotko(ost.at)) + ' by <b>' + esc(ost.by) + '</b>.' : ''),
    akcje: '<button class="btn primary duzy" data-cf="st=open&pr=P1&ef=S">' + ic('i-check') + 'Open quick critical items</button><button class="btn bialy duzy" data-skok="nie-rob">What not to do</button>',
    prawa: '<div class="kw-l">Done</div><div class="kw-v num">' + fmt(all.pct) + '%</div><div style="margin-top:14px">' + pasekPostepu(all, 14) + '</div>' +
      '<div class="kw-p"><span>' + all.done + ' done</span><span>' + all.open + ' open</span>' + (all.na ? '<span>' + all.na + ' not applicable</span>' : '') + '</div>' +
      '<div class="kw-w">' + ['P1', 'P2', 'P3'].map(function (k) { return '<div class="cpr"><span>' + k + ' ' + CHL.legend.p[k].toLowerCase() + '</span>' + pasekPostepu(p[k], 8) + '<b class="num">' + fmt(p[k].pct) + '%</b></div>'; }).join('') + '</div>'
  });
  /* sections at a glance, click jumps to the section */
  h += '<div class="csek">' + CHL.sections.map(function (sk) {
    var l = CHL.items.filter(function (i) { return i.id.split('.')[0] == sk.n; }), pp = postep(code, l);
    return '<button class="csk" data-skok="sek-' + sk.n + '"><span class="csk-t"><b>' + sk.n + '</b> ' + esc(sk.t) + '</span><span class="csk-n num">' + pp.done + '/' + pp.base + '</span>' + pasekPostepu(pp, 6) + '</button>';
  }).join('') + '</div>';
  /* filters */
  function seg(key, opts) { return '<div class="tabsm">' + opts.map(function (o) { return '<button data-cfk="' + key + '" data-cfv="' + o[0] + '" class="' + (CF[key] === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
  h += '<div class="cfil">' + seg('st', [['all', 'All'], ['open', 'Open'], ['done', 'Done'], ['na', 'Not applicable']]) +
    seg('pr', [['', 'Any priority'], ['P1', 'P1'], ['P2', 'P2'], ['P3', 'P3']]) + seg('ef', [['', 'Any effort'], ['S', 'S'], ['M', 'M'], ['L', 'L']]) +
    '<span class="gap"></span><input type="search" id="cf-q" placeholder="Find an item" value="' + esc(CF.q) + '" aria-label="Find an item"></div>';
  var q = CF.q.toLowerCase(), pokazane = 0;
  CHL.sections.forEach(function (sk) {
    var l = CHL.items.filter(function (i) { return i.id.split('.')[0] == sk.n; }), pp = postep(code, l);
    var w = l.filter(function (i) {
      var x = stan(code, i.id), st = x ? x.s : 'open';
      return (CF.st === 'all' || CF.st === st) && (!CF.pr || i.p === CF.pr) && (!CF.ef || i.e === CF.ef) && (!q || (i.id + ' ' + i.t + ' ' + i.d).toLowerCase().indexOf(q) >= 0);
    });
    if (!w.length) return;
    pokazane += w.length;
    h += '<section class="card csekcja" id="sek-' + sk.n + '"><div class="ch"><h2>' + sk.n + '. ' + esc(sk.t) + '<small>' + pp.done + ' of ' + pp.base + ' done' + (pp.na ? ', ' + pp.na + ' not applicable' : '') + '</small></h2><span class="gap"></span><div class="csek-p">' + pasekPostepu(pp, 8) + '<b class="num">' + fmt(pp.pct) + '%</b></div></div>' +
      w.map(function (i) {
        var x = stan(code, i.id), st = x ? x.s : 'open';
        return '<div class="cit ' + st + '" data-id="' + i.id + '"><button class="cbox" data-tick="' + i.id + '" aria-pressed="' + (st === 'done') + '" aria-label="Mark ' + i.id + ' as done">' + (st === 'done' ? ic('i-tick') : '') + '</button>' +
          '<span class="cid num">' + i.id + '</span><div class="ctx"><button class="cti" data-otworz="' + i.id + '" aria-expanded="' + !!OTWARTE[i.id] + '"><b>' + esc(i.t) + '</b>' + (i.d ? '<span>' + esc(i.d) + '</span>' : '') + (i.x ? '<i class="cmore">' + (OTWARTE[i.id] ? 'Hide details' : 'What, why and how') + '</i>' : '') + '</button>' +
          '<div class="ctg"><span class="tag pr' + i.p.slice(1) + '" title="' + CHL.legend.p[i.p] + '">' + i.p + ' ' + CHL.legend.p[i.p].toLowerCase() + '</span><span class="tag" title="Effort: ' + CHL.legend.e[i.e] + '">Effort ' + i.e + '</span><span class="tag" title="' + CHL.legend.w[i.w] + '">' + { O: 'Official', B: 'Study', P: 'Practice' }[i.w] + '</span>' +
          (code === 'PL' && i.a ? '<span class="tag audyt">EIG audit 6 Oct: ' + AUDYT[i.a] + '</span>' : '') +
          (i.uw && i.uw[code] ? '<span class="tag uw" title="' + esc(i.uw[code]) + '">' + esc(i.uw[code].split('. ')[0]) + '</span>' : '') + '</div>' + (OTWARTE[i.id] && i.x ? szczegolyPozycji(i, x) : '') + '</div>' +
          '<div class="cst">' + (x ? '<span>' + (st === 'done' ? 'Done' : 'Not applicable') + ' · ' + esc(kiedyKrotko(x.at)) + '</span><small>' + esc(x.by) + (x.pending ? ' · others see it within ~15 min' : '') + '</small>' : '') + '</div>' +
          '<button class="cna" data-na="' + i.id + '" title="' + (st === 'na' ? 'Count this item again' : 'This item does not apply to our store') + '">' + (st === 'na' ? 'Applies' : 'N/A') + '</button></div>';
      }).join('') + '</section>';
  });
  if (!pokazane) h += '<section class="card"><div class="pusto">No item matches the filters.</div></section>';
  h += '<section class="card nierob" id="nie-rob"><div class="ch"><h2>What not to do<small>common mistakes, not counted in progress</small></h2></div><ul>' + CHL.donts.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul></section>';
  return h;
}
function checklistaGrupy() {
  var w = M.map(function (m) { return { m: m, p: postep(m.code), p1: postep(m.code, CHL.items.filter(function (i) { return i.p === 'P1'; })) }; });
  var done = w.reduce(function (a, x) { return a + x.p.done; }, 0), base = w.reduce(function (a, x) { return a + x.p.base; }, 0);
  var h = hero({
    okres: 'AI readiness checklist ' + CHL.version + ' · ' + CHL.items.length + ' items per store · by ' + CHL.author,
    werdykt: 'Our stores have done <span class="kw">' + done + ' of ' + base + ' items</span>',
    zd: 'Each store ticks its own items. Critical items (P1) done: ' + w.map(function (x) { return '<b>' + esc(x.m.store) + '</b> ' + x.p1.done + ' of ' + x.p1.base; }).join(', ') + '.',
    prawa: '<div class="kw-l">Done, ' + M.length + ' stores</div><div class="kw-v num">' + fmt(base ? done / base * 100 : 0) + '%</div>' +
      '<div class="kw-w">' + w.map(function (x) { return '<div class="cpr" style="grid-template-columns:120px 1fr 44px"><span>' + logo(x.m.code, { PL: 20, UK: 19, NL: 14.5, DE: 16.7 }[x.m.code]) + '</span>' + pasekPostepu(x.p, 8) + '<b class="num">' + fmt(x.p.pct) + '%</b></div>'; }).join('') + '</div>'
  });
  h += '<div class="rk4">' + w.map(function (x) {
    return '<button class="card rkc" data-chk="' + x.m.code + '"><div class="lg">' + logo(x.m.code) + '<span>' + esc(x.m.name) + '</span></div><div class="kk">Done</div><div class="vv"><b class="num">' + fmt(x.p.pct) + '%</b><small>' + x.p.done + ' of ' + x.p.base + ' items</small></div>' +
      '<div style="margin:14px 0 16px">' + pasekPostepu(x.p, 10) + '</div><div class="mm"><span>Critical (P1)</span><b>' + x.p1.done + ' of ' + x.p1.base + '</b></div><div class="mm"><span>Not applicable</span><b>' + x.p.na + '</b></div></button>';
  }).join('') + '</div>';
  h += '<section class="card"><div class="ch"><h2>Progress by section<small>share of items done in each store, not applicable items left out</small></h2></div><div class="tw"><table class="t"><thead><tr><th>Section</th><th class="r">Items</th>' + M.map(function (m) { return '<th>' + esc(m.store) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    CHL.sections.map(function (sk) {
      var l = CHL.items.filter(function (i) { return i.id.split('.')[0] == sk.n; });
      return '<tr><td><b style="font-weight:500">' + sk.n + '. ' + esc(sk.t) + '</b></td><td class="r szary">' + l.length + '</td>' + M.map(function (m) { var pp = postep(m.code, l); return '<td><div class="bar-in">' + pasekPostepu(pp, 8) + '<span class="num" style="min-width:40px;text-align:right;font-weight:500">' + fmt(pp.pct) + '%</span></div></td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div></section>';
  return h;
}
function podepnijChecklist() {
  /* the name of the signed-in person, from the access list */
  var kto = function () { return mojeImie(); };
  function ustaw(id, s) {
    var code = S.market, by = kto(); if (!by) return;
    var e = { m: code, id: id, s: s || null, by: by, at: new Date().toISOString() };
    wyslijWiadomosc(e).then(function () {
      var l = czekajace(); l.push(e); try { localStorage.setItem('aiv-chk-pending', JSON.stringify(l)); } catch (x) {}
      polaczStan(); var y = window.scrollY; rysuj(); window.scrollTo(0, y);
    }).catch(function (err) { alert('The change was not saved: ' + (err && err.message || err) + '. Check the connection and try again.'); });
    zdarzenieUzycia('checklista', 'Checklist item changed · ' + rynek(code).store);
  }
  if (SKOK) { var sk = document.querySelector('.cit[data-id="' + SKOK + '"]'); SKOK = null; if (sk) setTimeout(function () { sk.scrollIntoView({ block: 'start' }); window.scrollBy(0, -72); }, 50); }
  document.querySelectorAll('[data-otworz]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-otworz'); if (OTWARTE[id]) delete OTWARTE[id]; else { OTWARTE[id] = 1; OST_OTW = id; } var y = window.scrollY; rysuj(); window.scrollTo(0, y); }; });
  document.querySelectorAll('[data-tick]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-tick'), x = stan(S.market, id); ustaw(id, x && x.s === 'done' ? null : 'done'); }; });
  document.querySelectorAll('[data-na]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-na'), x = stan(S.market, id); ustaw(id, x && x.s === 'na' ? null : 'na'); }; });
  document.querySelectorAll('[data-cfk]').forEach(function (b) { b.onclick = function () { CF[b.getAttribute('data-cfk')] = b.getAttribute('data-cfv'); rysuj(); }; });
  document.querySelectorAll('[data-cf]').forEach(function (b) { b.onclick = function () { var q = new URLSearchParams(b.getAttribute('data-cf')); CF.st = q.get('st') || 'all'; CF.pr = q.get('pr') || ''; CF.ef = q.get('ef') || ''; CF.q = ''; rysuj(); var c = document.querySelector('.cfil'); if (c) c.scrollIntoView({ block: 'start' }); }; });
  document.querySelectorAll('[data-skok]').forEach(function (b) { b.onclick = function () { var e = document.getElementById(b.getAttribute('data-skok')); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
  document.querySelectorAll('[data-chk]').forEach(function (b) { b.onclick = function () { wybierzRynek(b.getAttribute('data-chk')); S.chkAll = false; rysuj(); window.scrollTo(0, 0); }; });
  var q = document.getElementById('cf-q'); if (q) q.oninput = function () { CF.q = q.value; clearTimeout(q.t); q.t = setTimeout(function () { rysuj(); var n = document.getElementById('cf-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
}
PLASTER('checklist', {
  nazwa: 'Checklist', menu: { ikona: 'i-check' }, naSklep: true,
  grupa: function () { return !!S.chkAll; },
  naWszystkie: function () { S.chkAll = true; },
  poKliknieciuSklepu: function () { S.chkAll = false; },
  wczytaj: async function () {
    try { CHL = await (await fetch('config/checklist.json', { cache: 'no-store' })).json(); } catch (e) { CHL = null; }
    await wczytajStanChecklisty();
  },
  rysuj: widokChecklist,
  podepnij: podepnijChecklist,
  adres: adresChecklisty,
  zAdresu: function (q, sciezka) { if (S.view === 'checklist') { S.chkAll = sciezka[1] === 'all'; czytajFiltryChecklisty(q); } }
});
